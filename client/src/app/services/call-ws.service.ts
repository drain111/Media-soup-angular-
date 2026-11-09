import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';

export type JoinState = 'disconnected' | 'connecting' | 'joined' | 'fail';

export interface ServerPeerInfo {
  id: string;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class CallWsService implements OnDestroy {
  readonly state = signal<JoinState>('disconnected');
  /** Peers in the room (server broadcast). */
  readonly peers = signal<ServerPeerInfo[]>([]);
  /** When `state` == fail this holds a message. */
  readonly errorMsg = signal<string | null>(null);
  /** Our own user id, set from the joinRoom ack. */
  readonly myId = signal<string>('');
  /** Live mute / camera state — drives real track.enabled toggling. */
  readonly micOn = signal(true);
  readonly camOn = signal(true);
  readonly connected = signal(0);
  private socket: Socket | null = null;
  private http = inject(HttpClient);

  get wsUrl(): string {
    if (typeof window === 'undefined') return 'http://localhost:3002';
    const host = window.location.host;
    return host.replace(/:\d+$/, ':3002').replace(/^https:/, 'wss:');
  }

  ngOnDestroy(): void { this.reset(); }

  async joinRoom(code: string, _displayName: string): Promise<boolean> {
    this.reset();
    this.state.set('connecting');
    const token = await this.fetchToken().catch(() => '');
    if (!token) {
      this.fail('Cannot authenticate — you may need to log in again.');
      return false;
    }

    this.socket = io(this.wsUrl, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      reconnectionAttempts: 20,
    });

    try {
      await this.waitForConnect(30000);
      // Listen for the ack — it contains our id and the current headcount.
      const ack = (await this.socket.emitWithAck('joinRoom', code)) as { id: string;name?: string, count: number };
      if (ack?.id) {
        this.myId.set(ack.id);
      }
      // Baseline: set from the server's authoritative count at join time.
      this.peers.update((values) => [...values, {id:ack.id, name:ack.name}]);
      this.connected.set(ack.count)

      // joinedRoom: server payload is an array of RoomJoinData (no count — one join per event).
      this.socket.on('joinedRoom', (incoming: unknown) => {
        const list = Array.isArray(incoming) ? incoming : [incoming];
        const peers = list as ServerPeerInfo[];
        if (peers.some(p => p.id)) {
          this.peers.update(current => [
            ...current,
            ...peers.filter(p => !current.some(c => c.id === p.id))
          ]);
          this.connected.update(c => c + peers.filter(p => p.id).length);
        }
      });
      // leftRoom: server payload is the leaving socket.id (plain string).
      this.socket.on('leftRoom', (leavingId: unknown) => {
        const id = String(leavingId);
        const existed = this.peers().some(p => p.id === id);
        if (existed) {
          this.peers.update(current => current.filter(p => p.id !== id));
          this.connected.update(c => Math.max(0, c - 1));
        }
      });

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not (allowed|invited)/i.test(msg)) {
        this.fail("You're not invited to this session. Please ask the host to invite you.");
      } else if (/reconnect_failed/i.test(msg)) {
        this.fail('Could not connect to the video server. Check your network and try again.');
      } else if (/timeout/i.test(msg)) {
        this.fail('Connecting timed out. Please try again.');
      } else if (/missing token|log in error/i.test(msg)) {
        this.fail('You may need to log in again.');
      } else {
        this.fail(msg || 'Failed to join the room.');
      }
      return false;
    }
  }

  leaveRoom(): void {
    this.socket?.emit('leaveRoom');
    this.reset();
  }

  getSocket(): Socket | null { return this.socket; }

  on(event: string, fn: (...args: unknown[]) => void): void { this.socket?.on(event, fn); }
  off(event: string, fn: (...args: unknown[]) => void): void { this.socket?.off(event, fn); }
  emit(event: string, ...args: unknown[]): void { this.socket?.emit(event, ...args); }

  private reset(): void {
    const s = this.socket;
    this.socket = null;
    s?.removeAllListeners();
    s?.close();
    this.state.set('disconnected');
    this.peers.set([]);
    this.connected.set(0);
    this.errorMsg.set(null);
    this.micOn.set(true);
    this.camOn.set(true);
    this.myId.set('');
  }

  private fail(msg: string): void {
    const s = this.socket;
    this.socket = null;
    s?.removeAllListeners(); s?.close();
    this.state.set('fail');
    this.connected.set(0);
    this.errorMsg.set(msg);
  }

  private async fetchToken(): Promise<string | null> {
    try {
      const resp = await lastValueFrom(
        this.http.get<{ token: string }>('/api/session/token'),
      );
      if (resp?.token) {
        return resp?.token;
      }
      else {
        console.error('Failed to obtain token');
        return null;
      }
    }
    catch(e) {
      console.error('Failed to obtain token', e);
      return null;
    }
  }

  private waitForConnect(ms: number): Promise<void> {
    const socket = this.socket!;
    return new Promise<void>((resolve, reject) => {
      let done = false;
      const finish = (fn: () => void) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        socket.off('reconnect_failed', onReconnectFailed);
        fn();
      };
      const onConnect = () => finish(resolve);
      //this one triggers when the reconnectionAttemps gets to the final number
      const onReconnectFailed = () => finish(() => reject(new Error('reconnect_failed')));
      const onError = (err: Error) => {
        // Fail fast when the *server* refuses (auth guard or not-invited).
        // Transient network errors: ignore — socket.io keeps retrying on its own until `reconnect_failed` or the deadline.
        if (/missing token|log in error|not (allowed|invited)/i.test(err.message)) {
          finish(() => reject(err));
        }
      };
      const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), ms);
      socket.on('connect', onConnect);
      socket.on('connect_error', onError);
      socket.on('reconnect_failed', onReconnectFailed);
    });
  }
}
