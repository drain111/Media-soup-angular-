import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AccessCheck, SessionStore } from '../domain/ports.js';
import { parseNonNegativeInt } from '../utils/utils.js';

//nah new note, let's leave it like this until everythign is implemented. Then we are cheanging into redisom in case I leave this forever getting dust in my github and i want to come back in the future, that phrase above is clearer to understand
export const REDIS_SESSION_TTL_SECONDS = 8 * 60 * 60;
const NAMESPACE = process.env['REDIS_NAMESPACE'] ? `${process.env['REDIS_NAMESPACE']}:` : '';
const ROOM_HASH_KEY_PREFIX = `${NAMESPACE}room:`;
const SESSION_INDEX_PREFIX = `${NAMESPACE}session-index:`;

@Injectable()
export class RedisSessionStore implements SessionStore, OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private  logger = new Logger(RedisSessionStore.name);
  constructor() {}

  async onModuleInit(): Promise<void> {
    const host = process.env['REDIS_HOST'] || 'localhost';
    const port = parseNonNegativeInt(process.env['REDIS_PORT'], 6379);
    const db = parseNonNegativeInt(process.env['REDIS_DB'], 0);
    const password = process.env['REDIS_PASSWORD'] || undefined;
    this.client = new Redis({
      host: host,
      port: port,
      password: password,
      db,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      maxRetriesPerRequest: parseNonNegativeInt(process.env['REDIS_MAX_RETRIES'], 3),
    });
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.quit();
    } catch(err) {
        this.logger.warn(`Redis quit() failed, forcing disconnect: ${err instanceof Error ? err.message : String(err)}`);
      this.client.disconnect();
    }
  }


  async create(
    sessionId: string,
    data: { code: string; hostParticipantId: string; expiresAt: number; roomName: string },
    invites: string[],
    ttlSeconds: number,
  ): Promise<void> {
    if (ttlSeconds <= 0) {
      throw new Error('ttlSeconds must be positive');
    }
    const key = `${ROOM_HASH_KEY_PREFIX}${data.code}`;
    const indexKey = `${SESSION_INDEX_PREFIX}${sessionId}`;
    const multi = this.client.multi();
    multi.hset(key, {
      sessionId,
      code: data.code,
      hostParticipantId: data.hostParticipantId,
      expiresAt: String(data.expiresAt),
      roomName: data.roomName,
      loginKeys: JSON.stringify(invites),
    });
    multi.set(indexKey, data.code, 'EX', ttlSeconds); // same TTL, kept in sync
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();
    if (results?.some(([err]) => err)) {
      const errors = results.filter(([err]) => err).map(([err]) => err?.message);
      throw new Error(`Redis transaction failed: ${errors.join(', ')}`);
    }
  }

  async get(code: string): Promise<{ sessionId: string; code: string; hostParticipantId: string; roomName: string; invites: Set<string>; expiresAt: number } | null> {
    const key = `${ROOM_HASH_KEY_PREFIX}${code}`;
    const fields = await this.client.hgetall(key);
    if (!fields || !fields.sessionId) return null;
    let loginKeys: string[] = [];
    if (fields.loginKeys) {
      try { loginKeys = JSON.parse(fields.loginKeys); } catch { /* ignore */ }
    }
    return {
      sessionId: fields.sessionId,
      code: fields.code,
      hostParticipantId: fields.hostParticipantId,
      roomName: fields.roomName ?? '',
      invites: new Set(loginKeys),
      expiresAt: Number(fields.expiresAt),
    };
  }

  async updateInvites(code: string, loginKeys: string[]): Promise<number> {
    const key = `${ROOM_HASH_KEY_PREFIX}${code}`;
    const sessionId = await this.client.hget(key, 'sessionId');
    if (!sessionId) {
      throw new Error(`Room ${code} not found`);
    }
    await this.client.hset(key, 'loginKeys', JSON.stringify(loginKeys));
    return loginKeys.length;
  }

  async hasInvite(participantId: string, code: string): Promise<AccessCheck> {
    const room = await this.get(code);
    if (!room) return { allowed: false, reason: 'unknown' };
    if (room.expiresAt < Math.floor(Date.now() / 1000)) return { allowed: false, reason: 'expired' };
    if (participantId === room.hostParticipantId) return { allowed: true,  reason: 'host',    roomName: room.roomName };
    if (room.invites.has(participantId)) return { allowed: true,  reason: 'invited', roomName: room.roomName };
    return { allowed: false, reason: 'notInvited' };
  }

  
}
