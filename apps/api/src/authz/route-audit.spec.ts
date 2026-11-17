import 'reflect-metadata';
import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { permissions } from '@aegis/shared';
import { describe, expect, it } from 'vitest';
import { AuthController } from '../auth/auth.controller';
import { HealthController } from '../health/health.controller';
import { ProjectsController } from '../projects/projects.controller';
import { SecretsController } from '../secrets/secrets.controller';
import { WorkspacesController } from '../workspaces/workspaces.controller';
import { PUBLIC_ROUTES } from './public-routes';
import {
  AUTHENTICATED,
  PERMISSION_METADATA,
  type PermissionRequirement,
} from './require-permission.decorator';
import { normalizeRoutePath } from './route-key';

const REFLECTOR = new Reflector();
const CONTROLLERS: Type[] = [
  HealthController,
  AuthController,
  WorkspacesController,
  ProjectsController,
  SecretsController,
];

interface RouteEntry {
  route: string;
  requirement?: PermissionRequirement;
}

function entries(): RouteEntry[] {
  const result: RouteEntry[] = [];
  for (const controller of CONTROLLERS) {
    const prototype = controller.prototype as Record<string, unknown>;
    const controllerPath = REFLECTOR.get<string>(PATH_METADATA, controller) ?? '';
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (name === 'constructor' || typeof handler !== 'function') {
        continue;
      }
      const method = REFLECTOR.get<RequestMethod>(METHOD_METADATA, handler);
      if (method === undefined) {
        continue;
      }
      const handlerPath = REFLECTOR.get<string>(PATH_METADATA, handler) ?? '';
      result.push({
        route: `${RequestMethod[method]} ${normalizeRoutePath(controllerPath, handlerPath)}`,
        requirement:
          REFLECTOR.get<PermissionRequirement>(PERMISSION_METADATA, handler) ??
          REFLECTOR.get<PermissionRequirement>(PERMISSION_METADATA, controller),
      });
    }
  }
  return result;
}

describe('route authorization audit', () => {
  it('leaves no route without either a public allowlist entry or permission metadata', () => {
    const routes = entries();
    expect(routes.length).toBeGreaterThan(0);
    for (const entry of routes) {
      if (PUBLIC_ROUTES.has(entry.route)) {
        expect(entry.requirement).toBeUndefined();
      } else {
        expect(entry.requirement).toBeDefined();
      }
    }
  });

  it('keeps the public allowlist free of stale entries', () => {
    const discovered = new Set(entries().map((entry) => entry.route));
    for (const route of PUBLIC_ROUTES) {
      expect(discovered.has(route)).toBe(true);
    }
  });

  it('rejects unknown permission metadata', () => {
    const valid = new Set<string>([...permissions, AUTHENTICATED]);
    for (const entry of entries()) {
      if (entry.requirement) {
        expect(valid.has(entry.requirement)).toBe(true);
      }
    }
  });
});
