import { describe, it, expect, afterEach } from 'vitest';
import { Redis } from 'ioredis';
import { generateRoomCode } from '../src/utils/utils.js';
import { RedisSessionStore, REDIS_SESSION_TTL_SECONDS } from '../src/services/redis-store.service.js';

describe('RedisStore', () => {
  let redis: Redis;
  let store: RedisSessionStore;
  const db = Number(process.env['REDIS_DB']) ?? 2; // use a separate DB for tests

  beforeAll(async () => {
    redis = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: Number(process.env['REDIS_PORT']) ?? 6379,
      db,
      maxRetriesPerRequest: 3,
    });
    await redis.flushdb();
    store = new RedisSessionStore();
    // Replace the client onModuleInit would create so we use our test DB
    (store as any).client = redis;
  });

  afterEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('stores and retrieves a room with all fields', async () => {
    const code = generateRoomCode();
    const sessionId = 'fake-session-123';
    const hostParticipantId = 'google:abc123';
    const roomName = 'Test Room';
    const invites = ['user1@example.com'];
    const expiresAt = Math.floor(Date.now() / 1000) + REDIS_SESSION_TTL_SECONDS;

    await store.create(sessionId, { code, hostParticipantId, expiresAt, roomName }, invites, REDIS_SESSION_TTL_SECONDS);

    const room = await store.get(code);
    expect(room).toBeTruthy();
    expect(room!.code).toBe(code);
    expect(room!.hostParticipantId).toBe(hostParticipantId);
    expect(room!.roomName).toBe(roomName);
    expect(room!.invites).toEqual(new Set(invites));
  });

  it('returns null for missing code', async () => {
    const result = await store.get('nonexistent1');
    expect(result).toBeNull();
  });

  it('tracks sessions with session-index', async () => {
    const code = generateRoomCode();
    const sessionId = 'fake-session-456';
    const expiresAt = Math.floor(Date.now() / 1000) + REDIS_SESSION_TTL_SECONDS;

    await store.create(sessionId, { code, hostParticipantId: 'p1', expiresAt, roomName: 'X' }, [], REDIS_SESSION_TTL_SECONDS);

    const namespace = process.env['REDIS_NAMESPACE'] ? `${process.env['REDIS_NAMESPACE']}:` : '';
    const indexKey = `${namespace}session-index:${sessionId}`;

    expect(await redis.exists(indexKey)).toBe(1);
    expect(await redis.get(indexKey)).toBe(code);
    expect(await redis.exists(`${namespace}session-index:fake-session-999`)).toBe(0);
  });
});
