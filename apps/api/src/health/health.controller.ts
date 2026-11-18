import type Redis from 'ioredis';
import type { RequestHandler } from 'express';
import type { Connection } from 'mongoose';
import { defineRoute } from '../authz/route-manifest';
import type { ManagedRoute } from '../http/router';

interface HealthDependencies {
  connection?: Connection;
  redis?: Redis;
}

const live: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', service: 'aegis-api' });
};

export function createHealthRoutes(deps: HealthDependencies = {}): ManagedRoute[] {
  const ready: RequestHandler = async (_req, res) => {
    if (!deps.connection || deps.connection.readyState !== 1) {
      res.status(503).json({ status: 'not-ready', dependency: 'mongodb' });
      return;
    }
    if (!deps.connection.db) {
      res.status(503).json({ status: 'not-ready', dependency: 'mongodb' });
      return;
    }
    try {
      await deps.connection.db.admin().ping();
    } catch {
      res.status(503).json({ status: 'not-ready', dependency: 'mongodb' });
      return;
    }
    if (deps.redis && deps.redis.status !== 'ready') {
      res.status(503).json({ status: 'not-ready', dependency: 'redis' });
      return;
    }
    res.json({ status: 'ready', service: 'aegis-api' });
  };

  return [
    defineRoute({
      name: 'health.check',
      method: 'get',
      path: '/health',
      public: true,
      handler: live,
    }),
    defineRoute({
      name: 'health.live',
      method: 'get',
      path: '/health/live',
      public: true,
      handler: live,
    }),
    defineRoute({
      name: 'health.ready',
      method: 'get',
      path: '/health/ready',
      public: true,
      handler: ready,
    }),
  ];
}
