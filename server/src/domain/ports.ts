
export interface Identity {
  sub: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

export interface VerifyResult extends Identity {
  verified: true;
}

export interface UnverifiedResult {
  verified: false;
  reason: string;
}

export type Verification = VerifyResult | UnverifiedResult;

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(id: number): void;
}

export interface SessionStore {
  create(code: string, hostEmail: string, inviteEmails: string[]): Promise<void>;
  upsert(sessionId: string, data: { code: string; hostEmail: string; expiresAt: number }, invites: string[], ttlSeconds: number): Promise<void>;
  get(code: string): Promise<{ sessionId: string; code: string; hostEmail: string; invites: Set<string>; expiresAt: number } | null>;
  updateInvites(code: string, emails: string[]): Promise<number>;
  isMember(sessionId: string): Promise<boolean>;
  hasInvite(email: string, code: string): Promise<boolean>;
  scheduleExpiry(code: string, ttlMs: number, callback: () => void): void;
}

export interface RoomSignal {
  join(sessionId: string, socketId: string): void;
  leave(sessionId: string, socketId: string): void;
  broadcast(sid: string, room: string, event: string, payload?: unknown): void;
  emitTo(sid: string, event: string, payload?: unknown): void;
}

export interface MediaController {
  createTransport(): Promise<{ transportId: string; iceParameters: Record<string, string>; iceCandidates: string[]; sdp?: string }>;
  produce(transportId: string, kind: 'audio' | 'video', rtpParameters: unknown): Promise<{ producerId: string; kind: string; rtpParameters: unknown }>;
  getRouterParams(): { sdp: string; iceParameters: Record<string, string> };
}

export interface Participant {
  sessionId: string;
  socketId: string;
  email: string;
  displayName: string;
  isHost: boolean;
  joinedAt: number;
}
