
export interface Identity {
  sub: string;
  loginKey: string;
  displayName: string;
  photoUrl?: string;
}


export type AccessCheck = 
  | { allowed: true;  reason: 'host' | 'invited'; roomName: string }
  | { allowed: false; reason: 'unknown' | 'expired' | 'notInvited' };


export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(id: number): void;
}

export interface SessionStore {
  create(sessionId: string, data: { code: string; hostParticipantId: string; expiresAt: number; roomName: string }, invites: string[], ttlSeconds: number): Promise<void>;
  get(code: string): Promise<{ sessionId: string; code: string; hostParticipantId: string; roomName: string; invites: Set<string>; expiresAt: number } | null> ;
  updateInvites(code: string, loginKeys: string[]): Promise<number>;
  hasInvite(participantId: string, code: string): Promise<AccessCheck>;
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
  loginKey: string;
  displayName: string;
  isHost: boolean;
  joinedAt: number;
}
