import express from 'express';
import type Redis from 'ioredis';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHealthRoutes } from './health.controller';

function createTestApp(routes: ReturnType<typeof createHealthRoutes>) {
  const app = express();
  for (const route of routes) {
    app[route.method](route.path, ...(route.middlewares ?? []), route.handler);
  }
  return app;
}

function createConnection(ping: () => Promise<void> = async () => undefined) {
  return {
    readyState: 1,
    db: { admin: () => ({ ping }) },
  } as unknown as Connection;
}

describe('health routes', () => {
  it('exposes a liveness probe', async () => {
    const response = await request(createTestApp(createHealthRoutes())).get('/health/live').expect(200);
    expect(response.body).toEqual({ status: 'ok', service: 'aegis-api' });
  });

  it('reports ready when dependencies are available', async () => {
    const connection = createConnection();
    const redis = { status: 'ready' } as unknown as Redis;
    const response = await request(createTestApp(createHealthRoutes({ connection, redis })))
      .get('/health/ready')
      .expect(200);
    expect(response.body).toEqual({ status: 'ready', service: 'aegis-api' });
  });

  it('reports not-ready when mongodb is unavailable', async () => {
    const response = await request(createTestApp(createHealthRoutes())).get('/health/ready').expect(503);
    expect(response.body).toEqual({ status: 'not-ready', dependency: 'mongodb' });
  });

  it('reports not-ready when mongodb has no database handle', async () => {
    const connection = { readyState: 1 } as unknown as Connection;
    const response = await request(createTestApp(createHealthRoutes({ connection })))
      .get('/health/ready')
      .expect(503);
    expect(response.body).toEqual({ status: 'not-ready', dependency: 'mongodb' });
  });

  it('reports not-ready when mongodb ping fails', async () => {
    const connection = createConnection(async () => {
      throw new Error('offline');
    });
    const response = await request(createTestApp(createHealthRoutes({ connection })))
      .get('/health/ready')
      .expect(503);
    expect(response.body).toEqual({ status: 'not-ready', dependency: 'mongodb' });
  });

  it('reports not-ready when redis is unavailable', async () => {
    const connection = createConnection();
    const redis = { status: 'connecting' } as unknown as Redis;
    const response = await request(createTestApp(createHealthRoutes({ connection, redis })))
      .get('/health/ready')
      .expect(503);
    expect(response.body).toEqual({ status: 'not-ready', dependency: 'redis' });
  });
});
