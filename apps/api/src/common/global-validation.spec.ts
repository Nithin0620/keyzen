import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../http/error-handler';
import { globalValidation } from './global-validation';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(globalValidation());
  app.post('/', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('globalValidation', () => {
  it('allows ordinary JSON input', async () => {
    const response = await request(createTestApp()).post('/').send({ name: 'example' }).expect(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects unsafe keys', async () => {
    await request(createTestApp())
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"evil.key":"value"}')
      .expect(400);
  });

  it('rejects deeply nested input', async () => {
    let body: Record<string, unknown> = { value: 1 };
    for (let index = 0; index < 12; index += 1) {
      body = { nested: body };
    }
    await request(createTestApp()).post('/').send(body).expect(400);
  });

  it('rejects oversized arrays', async () => {
    await request(createTestApp()).post('/').send({ values: Array.from({ length: 201 }, () => 1) }).expect(400);
  });

  it('rejects unsupported runtime values', () => {
    const next = vi.fn();
    const middleware = globalValidation();
    middleware({ body: { bad: Symbol('bad') }, query: {}, params: {} } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });
});
