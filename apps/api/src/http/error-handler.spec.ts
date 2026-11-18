import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HttpException } from '../common/http-error';
import { requestId } from '../http/security';
import { errorHandler } from './error-handler';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

const SECRET = 'ags_abcdefghijklmnopqrstuvwxyz';

function createTestApp() {
  const app = express();
  app.use(requestId());
  app.use(express.json({ limit: '10b' }));
  app.get('/boom', () => {
    throw new Error(`database failed for ${SECRET}`);
  });
  app.get('/known', () => {
    throw new HttpException(
      {
        message: `Invalid ${SECRET}`,
        secret: SECRET,
        fields: [{ message: `bad ${SECRET}`, value: SECRET }],
      },
      400
    );
  });
  app.get('/known-plain', () => {
    throw new HttpException(
      `failed authorization=Bearer ${SECRET} for mongodb://user:pass@db.example.com/aegis`,
      400
    );
  });
  app.post('/json', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('returns a generic 500 and redacts unknown errors', async () => {
    const response = await request(createTestApp()).get('/boom').expect(500);
    expect(response.body).toEqual({ message: 'Internal server error' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain(SECRET);
  });

  it('sanitizes known error details', async () => {
    const response = await request(createTestApp()).get('/known').expect(400);
    expect(response.body.secret).toBe('[REDACTED]');
    expect(response.body.fields[0].value).toBe('[REDACTED]');
    expect(JSON.stringify(response.body)).not.toContain(SECRET);
  });

  it('redacts the fallback message for string errors', async () => {
    const response = await request(createTestApp()).get('/known-plain').expect(400);
    expect(response.body.message).not.toContain(SECRET);
    expect(response.body.message).not.toContain('user:pass');
    expect(response.body.message).toContain('[REDACTED]');
  });

  it('maps invalid JSON to 400', async () => {
    const response = await request(createTestApp())
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{invalid')
      .expect(400);
    expect(response.body).toEqual({ message: 'Invalid JSON', statusCode: 400 });
  });

  it('maps oversized payloads to 413', async () => {
    const response = await request(createTestApp())
      .post('/json')
      .send({ value: '12345678901234567890' })
      .expect(413);
    expect(response.body).toEqual({ message: 'Payload too large', statusCode: 413 });
  });
});
