import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthProvidersService } from './auth-providers.service.js';
import { CallWsService } from './call-ws.service.js';
export enum AccessState {
  /** Shown after auth loading finishes — stays until user is sure they're not allowed */
  Validating = 'validating',
  ConnectingRoom = 'connectingRoom', // ws join in progress
  Allowed = 'allowed',
  AllowedJoined = 'joined',   // ws connection succeeded
  NotLoggedIn = 'notLoggedIn',
  RoomNotFound = 'roomNotFound',
  NotInvited = 'notInvited',
  Error = 'error',
}
@Injectable({ providedIn: 'root' })
export class CallAccessService {
  private http = inject(HttpClient);
  private callWs = inject(CallWsService);
  auth = inject(AuthProvidersService);
  readonly state = signal<AccessState>(AccessState.Validating); // neutral — never an error at init
  readonly roomName = signal<string | null>(null);
  /** Room code to validate after auth resolves */
  private _pendingCode: string | null = null;
  private isResolving = false;
  constructor() {
    // Re-check once auth loading stops and we have a pending code
    effect(() => {
      const loading = this.auth.loading();
      if (loading) return; // still pending — stay in current state
      const code = this._pendingCode;
      if (!code) return; // check() hasn't been called yet — leave state as Validating
      this._pendingCode = null;

      // While we're in a joining/connecting phase, don't overwrite it.
      const cur = this.state();
      if (cur === AccessState.ConnectingRoom || cur === AccessState.AllowedJoined) return;

      // No user → show error directly, don't redirect (user could try again)
      const user = this.auth.user();
      if (!user) {
        this.state.set(AccessState.NotLoggedIn);
        return;
      }
      this.doCheck(code);
    });
  }
  check(code: string): void {
    // Skip duplicate calls — same code again, don't re-fire HTTP
    if (this.isResolving && code === this._pendingCode) return;
    if (!code || !code.trim()) {
      this.state.set(AccessState.RoomNotFound);
      return;
    }
    const loading = this.auth.loading();
    // Auth still resolving or user just logged in — defer validation until ready
    if (loading) {
      this.isResolving = true;
      this._pendingCode = code; // <-- add this
      this.state.set(AccessState.Validating);
      return;
    }
    //should I redirect or should I show this message??
    /*const user = this.auth.user();
    if (!user) {
      // No session at all — redirect instead of showing page
      this.router.navigate(['/']);
      return;
    }*/
    this.doCheck(code);
  }
  private doCheck(code: string): void {
    const user = this.auth.user();
    if (!user) {
      this.state.set(AccessState.NotLoggedIn);
      return;
    }
    this.http.get<{ allowed: boolean; roomName?: string }>('/api/rooms/' + code).subscribe({
      next: (resp) => {
        if (!this.auth.user()) {
          this.state.set(AccessState.NotLoggedIn);
          return;
        }
        this.isResolving = false;
        this.roomName.set(resp.roomName ?? null);
        if (resp.allowed) {
          this.state.set(AccessState.Allowed);   // ✅ go live — user sees prep screen with skeleton behind it for smooth transition
        } else {
          this.state.set(AccessState.NotInvited); // ❌ error — no skeleton flash
        }
      },
      error: (err) => {
        const status = err?.status;
        if (!this.auth.user()) {
          this.state.set(AccessState.NotLoggedIn);
        } else if (status === 401 || status === 403) {
          this.state.set(AccessState.NotInvited);   // ❌ error — no skeleton flash
        } else if (status === 404) {
          this.state.set(AccessState.RoomNotFound); // ❌ error — no skeleton flash
        } else {
          this.state.set(AccessState.NotInvited);
        }
      },
    });
  }

  async startJoin(code: string, displayName: string): Promise<void> {
    this.state.set(AccessState.ConnectingRoom);
    const success = await this.callWs.joinRoom(code, displayName);
    if (success && this.auth.user()) {
      this.state.set(AccessState.AllowedJoined);
    } else {
      const errState = this.callWs.errorMsg() ? AccessState.Error : AccessState.NotInvited;
      this.state.set(errState);
    }
  }
}
