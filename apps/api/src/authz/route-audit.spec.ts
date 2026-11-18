import { permissions } from '@aegis/shared';
import { describe, expect, it } from 'vitest';
import { buildRoutes } from '../container';
import { PUBLIC_ROUTES } from './public-routes';
import { AUTHENTICATED, ROUTES, routeKey } from './route-manifest';

buildRoutes({} as any);

describe('route authorization audit', () => {
  it('leaves no route without either a public allowlist entry or permission metadata', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
    for (const route of ROUTES) {
      const key = routeKey(route.method, route.path);
      if (PUBLIC_ROUTES.has(key)) {
        expect(route.permission).toBeUndefined();
        expect(route.public).toBe(true);
      } else {
        expect(route.permission).toBeDefined();
        expect(route.public).toBeUndefined();
      }
    }
  });

  it('keeps the public allowlist free of stale entries', () => {
    const discovered = new Set(ROUTES.map((route) => routeKey(route.method, route.path)));
    for (const route of PUBLIC_ROUTES) {
      expect(discovered.has(route)).toBe(true);
    }
  });

  it('marks every product route for logging', () => {
    const audited = ROUTES.filter((route) => route.audit);
    expect(audited.length).toBeGreaterThan(0);
    for (const route of ROUTES) {
      if (/^(secrets|workspaces|projects|audit|credentials)\./.test(route.name)) {
        expect(route.audit).toBe(route.method === 'get' ? 'read' : 'write');
      }
      if (/^runtime\./.test(route.name)) {
        expect(route.audit).toBe('read');
      }
    }
    expect(ROUTES.some((route) => route.name === 'secrets.rollback' && route.audit === 'write')).toBe(true);
    expect(ROUTES.some((route) => route.name === 'audit.list' && route.audit === 'read')).toBe(true);
    expect(ROUTES.some((route) => route.name === 'credentials.revoke' && route.audit === 'write')).toBe(true);
  });

  it('uses service-token auth only for runtime routes', () => {
    const serviceTokenRoutes = ROUTES.filter((route) => route.auth === 'serviceToken');
    expect(serviceTokenRoutes.map((route) => route.name).sort()).toEqual(['runtime.resolve', 'runtime.validate']);
    for (const route of serviceTokenRoutes) {
      expect(route.permission).toBe(AUTHENTICATED);
      expect(route.public).toBeUndefined();
    }
    for (const route of ROUTES) {
      if (!serviceTokenRoutes.includes(route) && !route.public) {
        expect(route.auth ?? 'jwt').toBe('jwt');
      }
    }
  });

  it('rejects unknown permission metadata', () => {
    const valid = new Set<string>([...permissions, AUTHENTICATED]);
    for (const route of ROUTES) {
      if (route.permission) {
        expect(valid.has(route.permission)).toBe(true);
      }
    }
  });
});
