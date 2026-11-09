import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { getRedisConfig, REDIS_NAMESPACE } from '../config/redis.config.js';
import { AccessCheck } from '../domain/session-user.js';

export const REDIS_SESSION_TTL_SECONDS = 8 * 60 * 60;
const ROOM_HASH_KEY_PREFIX = `${REDIS_NAMESPACE}room:`;
const SESSION_INDEX_PREFIX = `${REDIS_NAMESPACE}session-index:`;

@Injectable()
export class RedisRoomStore implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private readonly logger = new Logger(RedisRoomStore.name);

  async onModuleInit(): Promise<void> {
    const config = getRedisConfig();
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      maxRetriesPerRequest: 3,
    });
    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`, err.stack);

    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch (err) {
      this.logger.log(err)
      this.client.disconnect();
    }
  }

  async create(
    sessionId: string,
    data: { code: string; hostParticipantId: string; expiresAt: number; roomName: string },
    loginKeys: string[],
    ttlSeconds: number,
  ): Promise<void> {
    if (ttlSeconds <= 0) throw new Error('ttlSeconds must be positive');

    const key = `${ROOM_HASH_KEY_PREFIX}${data.code}`;
    const indexKey = `${SESSION_INDEX_PREFIX}${sessionId}`;
    const multi = this.client.multi();
    multi.hset(key, {
      sessionId,
      code: data.code,
      hostParticipantId: data.hostParticipantId,
      expiresAt: String(data.expiresAt),
      roomName: data.roomName,
      loginKeys: JSON.stringify(loginKeys),
    });
    multi.set(indexKey, data.code, 'EX', ttlSeconds);
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

  async hasInvite(participantId: string, code: string): Promise<AccessCheck> {
    const room = await this.get(code);
    if (!room) return { allowed: false, reason: 'unknown' };
    //this one shouldn't trigger, but who knows, just in case. well, technically, now that we have it at 8 hours in the redis store I guess it will
    if (room.expiresAt < Math.floor(Date.now() / 1000)) return { allowed: false, reason: 'expired' };
    if (participantId === room.hostParticipantId) return { allowed: true,  reason: 'host',    roomName: room.roomName };
    if (room.invites.has(participantId)) return { allowed: true,  reason: 'invited', roomName: room.roomName };
    return { allowed: false, reason: 'notInvited' };
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

  async removeRoom(code: string): Promise<void> {
    const key = `${ROOM_HASH_KEY_PREFIX}${code}`;
    const fields = await this.client.hgetall(key);
    if (fields?.sessionId) {
      await this.client.del(`${SESSION_INDEX_PREFIX}${fields.sessionId}`);
    }
    await this.client.del(key);
  }

  async getRoomBySession(sessionId: string): Promise<{ sessionId: string; code: string; hostParticipantId: string; roomName: string; loginKeys: string[]; expiresAt: number } | null> {
    const code = await this.client.get(`${SESSION_INDEX_PREFIX}${sessionId}`);
    if (!code) return null;
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
      loginKeys,
      expiresAt: Number(fields.expiresAt),
    };
  }

  getClient(): Redis {
    return this.client;
  }
}
