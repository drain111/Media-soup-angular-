import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

function cookieValue(setCookie: string[] | undefined, name: string): string | undefined {
  const line = setCookie?.find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0].slice(name.length + 1) || undefined;
}

describe('login', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('lists the fake provider outside production', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/providers').expect(200);
    expect(res.body).toEqual([{ id: 'fake', label: 'Fake (dev only)' }]);
  });

  it('answers 404 for an unknown provider', async () => {
    await request(app.getHttpServer()).get('/api/auth/constructor/redirect').expect(404);
  });

  it('logs in, exposes the user and logs out', async () => {
    const http = request(app.getHttpServer());

    const redirect = await http.get('/api/auth/fake/redirect').expect(302);
    const state = cookieValue(redirect.headers['set-cookie'] as unknown as string[], 'oauth_state');
    expect(state).toBeTruthy();

    const callback = await http
      .get(`/api/auth/fake/callback?code=alice&state=${state}&scope=ignored`)
      .set('Cookie', `oauth_state=${state}`)
      .expect(302);
    expect(callback.headers['location']).toBe('/');
    const sid = cookieValue(callback.headers['set-cookie'] as unknown as string[], 'sid');
    expect(sid).toBeTruthy();

    const me = await http.get('/api/session').set('Cookie', `sid=${sid}`).expect(200);
    expect(me.body).toMatchObject({ email: 'alice@example.com', name: 'Alice' });

    await http.delete('/api/session').set('Cookie', `sid=${sid}`).expect(204);
  });

  it('rejects a callback with a wrong or missing state', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/auth/fake/callback?code=alice&state=nope').set('Cookie', 'oauth_state=other').expect(400);
    await http.get('/api/auth/fake/callback?code=alice&state=nope').expect(400);
  });

  it('answers 401 without a valid login cookie', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/session').expect(401);
    await http.get('/api/session').set('Cookie', 'sid=forged.token.value').expect(401);
  });
});
