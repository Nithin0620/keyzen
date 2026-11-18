import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../http/error-handler';
import { createCors, normalizeOrigin } from './cors';

function createTestApp() {
  const app = express();
  app.use(createCors(['https://app.example.com/']));
  app.get('/', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('cors', () => {
  it('normalizes origins', () => {
    expect(normalizeOrigin('https://app.example.com/callback')).toBe('https://app.example.com');
  });

  it('allows configured origins', async () => {
    const response = await request(createTestApp()).get('/').set('Origin', 'https://app.example.com').expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers.vary).toBe('Origin');
  });

  it('answers preflight requests for configured origins', async () => {
    await request(createTestApp())
      .options('/')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
  });

  it('rejects unknown origins', async () => {
    const response = await request(createTestApp()).get('/').set('Origin', 'https://evil.example.com').expect(403);
    expect(response.headers.vary).toBe('Origin');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not set CORS headers when no origin is sent', async () => {
    const response = await request(createTestApp()).get('/').expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
