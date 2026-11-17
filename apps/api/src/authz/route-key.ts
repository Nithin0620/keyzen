import 'reflect-metadata';
import { RequestMethod, type ExecutionContext, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { Reflector } from '@nestjs/core';

export function normalizeRoutePath(...parts: string[]): string {
  const segments = parts
    .flatMap((part) => part.split('/'))
    .filter((segment) => segment.length > 0);
  return segments.length > 0 ? `/${segments.join('/')}` : '/';
}

export function routeKey(reflector: Reflector, context: ExecutionContext): string {
  const controller = context.getClass<Type>();
  const handler = context.getHandler();
  const controllerPath = reflector.get<string>(PATH_METADATA, controller) ?? '';
  const handlerPath = reflector.get<string>(PATH_METADATA, handler) ?? '';
  const method = reflector.get<RequestMethod>(METHOD_METADATA, handler);
  const methodName = RequestMethod[method] ?? String(method);
  return `${methodName} ${normalizeRoutePath(controllerPath, handlerPath)}`;
}

export function controllerRouteKeys(reflector: Reflector, controller: Type): string[] {
  const prototype = controller.prototype as Record<string, unknown>;
  const controllerPath = reflector.get<string>(PATH_METADATA, controller) ?? '';
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = prototype[name];
      if (typeof handler !== 'function') {
        return undefined;
      }
      const method = reflector.get<RequestMethod>(METHOD_METADATA, handler);
      if (method === undefined) {
        return undefined;
      }
      const handlerPath = reflector.get<string>(PATH_METADATA, handler) ?? '';
      return `${RequestMethod[method]} ${normalizeRoutePath(controllerPath, handlerPath)}`;
    })
    .filter((route): route is string => route !== undefined);
}
