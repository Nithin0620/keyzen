import type { NextFunction, RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import { defineRoute } from '../authz/route-manifest';
import type { ManagedRoute } from '../http/router';
import { generateOpenApi } from './openapi';

let cachedSpec: ReturnType<typeof generateOpenApi> | undefined;

function getOpenApiSpec(): ReturnType<typeof generateOpenApi> {
  cachedSpec ??= generateOpenApi();
  return cachedSpec;
}

const openapiHandler: RequestHandler = (_req, res) => {
  res.json(getOpenApiSpec());
};

const swaggerHandler: RequestHandler = (req, res, next) => {
  const spec = getOpenApiSpec();
  const handlers = [
    ...swaggerUi.serveFiles(spec as any, { explorer: false }),
    swaggerUi.setup(spec as any, { explorer: false }),
  ];
  let index = 0;
  const dispatch: NextFunction = (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    const handler = handlers[index++];
    if (!handler) {
      return;
    }
    handler(req, res, dispatch);
  };
  dispatch();
};

export const docsRoutes: ManagedRoute[] = [
  defineRoute({
    name: 'docs.openapi',
    method: 'get',
    path: '/openapi.json',
    public: true,
    handler: openapiHandler,
  }),
  defineRoute({
    name: 'docs.swagger',
    method: 'get',
    path: '/docs',
    public: true,
    handler: swaggerHandler,
  }),
  defineRoute({
    name: 'docs.assets',
    method: 'get',
    path: '/docs/*',
    public: true,
    handler: swaggerHandler,
  }),
];
