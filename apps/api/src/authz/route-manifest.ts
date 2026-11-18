import type { Permission } from '@aegis/shared';

export const AUTHENTICATED = 'authenticated';

export type PermissionRequirement = Permission | typeof AUTHENTICATED;

export type RouteMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type AuditKind = 'read' | 'write';

export type RouteAuth = 'jwt' | 'serviceToken';

export interface RouteDefinition {
  name: string;
  method: RouteMethod;
  path: string;
  public?: boolean;
  auth?: RouteAuth;
  permission?: PermissionRequirement;
  audit?: AuditKind;
}

export const ROUTES: RouteDefinition[] = [];

const ROUTE_NAMES = new Set<string>();

export function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

export function defineRoute<T extends RouteDefinition>(definition: T): T {
  if (!definition.public && !definition.permission) {
    throw new Error(`Route ${definition.name} is missing permission metadata`);
  }
  if (definition.public && definition.permission) {
    throw new Error(`Public route ${definition.name} must not have permission metadata`);
  }
  if (!ROUTE_NAMES.has(definition.name)) {
    ROUTE_NAMES.add(definition.name);
    ROUTES.push({
      name: definition.name,
      method: definition.method,
      path: definition.path,
      public: definition.public,
      auth: definition.auth,
      permission: definition.permission,
      audit: definition.audit,
    });
  }
  return definition;
}

export function auditedRoute<T extends RouteDefinition>(definition: T): T {
  return defineRoute({
    ...definition,
    audit: definition.method === 'get' ? 'read' : 'write',
  });
}
