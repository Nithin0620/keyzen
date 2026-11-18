import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../http/error-handler';
import { enforceTls, limitUrl, requestId } from './security';

function createTestApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(requestId());
  app.use(limitUrl(16));
  app.use(enforceTls(true));
  app.get('/', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('request security middleware', () => {
  it('adds a request id', async () => {
    const response = await request(createTestApp()).get('/').set('X-Forwarded-Proto', 'https').expect(200);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('requires HTTPS when enforced', async () => {
    await request(createTestApp()).get('/').expect(403);
  });

  it('rejects overly long URLs', async () => {
    await request(createTestApp()).get('/a-very-long-path').expect(414);
  });
});
