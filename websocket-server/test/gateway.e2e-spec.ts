import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SignJWT } from 'jose';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { RedisRoomStore } from '../src/service/redis-room-store.service.js';
import type { INestApplication } from '@nestjs/common';

const SESSION_SECRET = process.env['SESSION_SECRET'] || 'dev-only-secret-change-me-0123456789abcdef';
const PORT = 6380;
const WS_URL = `http://127.0.0.1:${PORT}`;

async function signToken(payload: { sub: string; loginKey: string; name?: string }): Promise<string> {
  const key = new TextEncoder().encode(SESSION_SECRET);
  return new SignJWT({ loginKey: payload.loginKey, name: payload.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

function connectClient(auth: Record<string, string>): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, { transports: ['websocket'], auth, reconnection: false });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

describe('AppGateway (e2e)', () => {
  //let redisContainer: StartedRedisContainer;
  let app: INestApplication;
  let redisStore: RedisRoomStore;

  const HOST_ID = 'google:host-sub';
  const INVITED_ID = 'google:invited-sub';
  const STRANGER_ID = 'google:stranger-sub';
  const ROOM_CODE = 'TESTROOM1';

  beforeAll(async () => {
    //can't manage to permanently open the podman ports in windows for some reason, only temporary, therefore I spawn the instances. Hope that when I test the software as a docker image I can uncomment this for easy CI/CD deployment
    /*redisContainer = await new RedisContainer('redis:7-alpine').start();

    process.env['SESSION_SECRET'] = SESSION_SECRET;
    process.env['REDIS_HOST'] = '127.0.0.1';
    process.env['REDIS_PORT'] = String(redisContainer.getMappedPort(6379));
    process.env['REDIS_DB'] = '0';
    process.env['REDIS_NAMESPACE'] = 'e2e-test';*/

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(PORT);

    redisStore = moduleRef.get(RedisRoomStore);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    //await redisContainer?.stop();
  });

  beforeEach(async () => {
    await redisStore.create(
      `${HOST_ID}@seed`,
      { code: ROOM_CODE, hostParticipantId: HOST_ID, expiresAt: Math.floor(Date.now() / 1000) + 3600, roomName: 'Test Room' },
      [INVITED_ID],
      3600,
    );
  });

  it('lets the host join and broadcasts to the room', async () => {
    const token = await signToken({ sub: HOST_ID, loginKey: 'host@example.com', name: 'Host User' });
    const socket = await connectClient({ token });

    const joined = new Promise<{ id: string; name: string }>((resolve) => {
      socket.on('joinedRoom', resolve);
    });

    socket.emit('joinRoom', ROOM_CODE);

    const payload = await joined;
    expect(payload.id).toBe(HOST_ID);
    expect(payload.name).toBe('Host User');

    socket.disconnect();
  });

  it('lets an invited (non-host) user join', async () => {
    const token = await signToken({ sub: INVITED_ID, loginKey: 'invited@example.com', name: 'Invited User' });
    const socket = await connectClient({ token });

    const joined = new Promise<{ id: string; name: string }>((resolve) => {
      socket.on('joinedRoom', resolve);
    });

    socket.emit('joinRoom', ROOM_CODE);

    const payload = await joined;
    expect(payload.id).toBe(INVITED_ID);

    socket.disconnect();
  });

  it('rejects connection with a missing token', async () => {
    await expect(connectClient({})).rejects.toThrow();
  });

  it('rejects connection with an invalid token', async () => {
    await expect(connectClient({ token: 'not-a-real-jwt' })).rejects.toThrow();
  });

  it('rejects an authenticated but uninvited user at the room-join step', async () => {
    const token = await signToken({ sub: STRANGER_ID, loginKey: 'stranger@example.com', name: 'Stranger' });
    const socket = await connectClient({ token }); // connection itself succeeds — auth passed

    const errorOrJoin = await new Promise<{ event: string; data: unknown }>((resolve) => {
      socket.on('joinedRoom', (data) => resolve({ event: 'joinedRoom', data }));
      socket.on('exception', (data) => resolve({ event: 'exception', data })); // Nest WS default error channel
      socket.emit('joinRoom', ROOM_CODE);
    });

    expect(errorOrJoin.event).toBe('exception');

    socket.disconnect();
  });
});