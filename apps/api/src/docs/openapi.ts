import * as shared from '@aegis/shared';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ROUTES } from '../authz/route-manifest';
import { ACCESS_COOKIE } from '../common/cookies';

type OpenApiObject = Record<string, unknown>;

function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    'safeParse' in value &&
    typeof (value as ZodTypeAny).safeParse === 'function'
  );
}

function openApiPath(path: string): string {
  if (path === '/docs/*') {
    return '/docs/{path}';
  }
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

export function generateOpenApi(): OpenApiObject {
  const schemas: OpenApiObject = {};
  for (const [name, value] of Object.entries(shared)) {
    if (isZodSchema(value)) {
      const schema = value as unknown as ZodTypeAny;
      schemas[name] = zodToJsonSchema(schema as any, { target: 'openApi3', $refStrategy: 'none' });
    }
  }

  const paths: OpenApiObject = {};
  for (const route of ROUTES) {
    const path = openApiPath(route.path);
    const parameters = [...path.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => ({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const operation: OpenApiObject = {
      operationId: route.name,
      summary: route.name,
      tags: [route.name.split('.')[0]],
      responses: {
        '200': { description: 'Success' },
        '400': { description: 'Invalid input' },
        '401': { description: 'Unauthenticated' },
        '403': { description: 'Forbidden' },
        '404': { description: 'Not found' },
        '429': { description: 'Rate limited' },
        '500': { description: 'Internal server error' },
      },
    };
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
    if (!route.public) {
      operation.security =
        route.auth === 'serviceToken'
          ? [{ serviceToken: [] }]
          : [{ cookieAuth: [] }];
    }
    const methods = (paths[path] ?? {}) as OpenApiObject;
    methods[route.method] = operation;
    paths[path] = methods;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Aegis API',
      version: '0.1.0',
      description: 'API for the Aegis cloud secrets manager.',
    },
    paths,
    components: {
      schemas,
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: ACCESS_COOKIE },
        serviceToken: { type: 'http', scheme: 'bearer', bearerFormat: 'ags_' },
      },
    },
  };
}
