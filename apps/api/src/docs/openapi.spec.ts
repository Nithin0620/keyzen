import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { TokenService } from '../auth/token.service';
import type { RouteDependencies } from '../container';
import { generateOpenApi } from './openapi';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';

function registerRoutes(): void {
  const deps: RouteDependencies = {
    audits: { record: vi.fn(async () => undefined) } as any,
    tokens: new TokenService(),
    policy: { evaluate: vi.fn(async () => true) } as any,
    auth: {} as any,
    google: {} as any,
    rateLimit: {} as any,
    workspaces: {} as any,
    projects: {} as any,
    secrets: {} as any,
    rotation: {} as any,
    serviceTokens: {} as any,
  };
  createApp(deps);
}

describe('generateOpenApi', () => {
  it('documents routes and shared schemas', () => {
    registerRoutes();
    const spec = generateOpenApi() as any;
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.paths['/health/live'].get).toBeDefined();
    expect(spec.paths['/workspaces/{workspaceId}/billing'].get.security).toEqual([{ cookieAuth: [] }]);
    expect(spec.paths['/v1/secrets/resolve'].post.security).toEqual([{ serviceToken: [] }]);
    expect(Object.keys(spec.components.schemas)).toContain('signupSchema');
    expect(spec.components.securitySchemes.cookieAuth).toEqual({
      type: 'apiKey',
      in: 'cookie',
      name: 'aegis_access',
    });
  });
});
