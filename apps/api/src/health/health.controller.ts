import type { RequestHandler } from 'express';
import { defineRoute } from '../authz/route-manifest';
import type { ManagedRoute } from '../http/router';

const check: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', service: 'aegis-api' });
};

export const healthRoutes: ManagedRoute[] = [
  defineRoute({
    name: 'health.check',
    method: 'get',
    path: '/health',
    public: true,
    handler: check,
  }),
];
