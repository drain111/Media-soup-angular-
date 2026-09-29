import { SessionStore, Participant } from './ports.js';
import crypto from 'node:crypto';

export interface SessionEventPayload {
  event: string;
  payload: unknown;
}

export interface ParticipantWithSocket extends Participant {
  socketId: string;
  producerIds?: Map<string, Set<string>>; // participantId -> {kind -> producerId}
}

const CODE_LENGTH = 6;
const CHAR_SET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let result = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    result += CHAR_SET[bytes[i] % CHAR_SET.length];
  }
  return result;
}

export class SessionService {
  constructor(
    private readonly store: SessionStore,
    private readonly clock: import('./ports.js').Clock,
    private participants: Map<string, ParticipantWithSocket> = new Map(),
  ) {}

  async createSession(codeSeed: string, hostEmail: string, inviteEmails: string[]): Promise<{ code: string }> {
    // Normalize invites to lowercase
    const normalizedInvites = [...new Set(inviteEmails.map(e => e.toLowerCase()))];
    
    let code = codeSeed || this.generateUniqueCode();
    let maxRetries = 10;
    
    while (maxRetries-- > 0) {
      try {
        await this.store.create(code, hostEmail, normalizedInvites);
        // Set expiry in store (infrastructure handles TTL)
        return { code };
      } catch (err: unknown) {
        const isEExist =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'EEXIST';

      if (isEExist || maxRetries === 0) {
        throw new Error('Failed to generate unique room code');
      }
        code = this.generateUniqueCode();
      }
    }
    
    return { code };
  }

  private generateUniqueCode(): string {
    return generateCode();
  }

  async joinSession(sessionId: string, email: string, displayName: string, socketId: string): Promise<{
    isMember: boolean;
    expiresAt: number;
    invites: string[];
  }> {
    const session = await this.store.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Host always may join
    const isHost = email.toLowerCase() === session.hostEmail.toLowerCase();
    if (isHost) return { isMember: true, expiresAt: session.expiresAt, invites: [] };

    // Check invite list
    const hasInvite = await this.store.hasInvite(email.toLowerCase(), sessionId);
    if (!hasInvite) throw new Error('Not invited to this session');

    const participant: ParticipantWithSocket = {
      sessionId,
      socketId,
      email,
      displayName,
      isHost,
      joinedAt: this.clock.now(),
      producerIds: new Map(),
    };

    this.participants.set(socketId, participant);
    
    return { isMember: true, expiresAt: session.expiresAt, invites: [] };
  }

  getParticipantBySocket(socketId: string): ParticipantWithSocket | undefined {
    return this.participants.get(socketId);
  }

  isHost(participant: ParticipantWithSocket): boolean {
    return participant.isHost;
  }

  async updateInvites(sessionId: string, hostEmail: string, newInvites: string[]): Promise<void> {
    const session = await this.store.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    // Get the latest invite list from store
    const existing = await this.store.hasInvite(hostEmail.toLowerCase(), sessionId);
    const normalizedInvites = [...new Set(newInvites.map(e => e.toLowerCase()))];
    await this.store.updateInvites(sessionId, normalizedInvites);
  }

  getConnectedSessionIds(): string[] {
    return [...this.participants.values()]
      .filter(p => p.socketId)
      .map(p => p.sessionId);
  }

  getParticipantsInSession(sessionId: string): ParticipantWithSocket[] {
    return [...this.participants.values()].filter(p => p.sessionId === sessionId);
  }

  removeParticipant(socketId: string): void {
    this.participants.delete(socketId);
  }

  clearAll(): void {
    this.participants.clear();
  }

  setTTL(ttlSeconds: number): void {
    // TTL is stored in Redis by the store; accessible via env var SESSION_TTL_SECONDS
  }
}
