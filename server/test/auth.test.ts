import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/api/index.js';

let app: express.Express;
const state = process.env.STATE || "a";

beforeAll(() => {
  app = createApp();
});

describe('GET /api/auth/fake/login-url', () => {
  it('returns the fake login URL with state query param', async () => {
    const res = await request(app).get('/api/auth/fake/login-url');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toContain('/api/auth/fake/callback?code=alice&state=' + state);
  });
});

describe('GET /api/auth/fake/callback', () => {
  it('returns user info for a known user code', async () => {
    const res = await request(app).get('/api/auth/fake/callback?code=alice');

    expect(res.statusCode).toBe(200);
    expect(res.body.user.provider).toBe('fake');
    expect(res.body.user.subject).toBeDefined();
  });

  it('returns 400 for unknown user codes', async () => {
    const res = await request(app).get('/api/auth/fake/callback?code=unknown_user_code');

    expect(res.statusCode).toBe(400); 
    expect(res.body.message).toMatch(/Unknown/); 
  });

  it('returns error when no code is provided', async () => {
    const res = await request(app).get('/api/auth/fake/callback');

    expect(res.statusCode).toBe(400);   
  });
});
