import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { routeRegistry } from '../../decorators/registry';
import { HttpMethod, METADATA_KEYS, RouteMetadata } from '../../decorators/metadata';
import { ApiEnvelopeSchema, ApiErrorSchema } from './envelope';

extendZodWithOpenApi(z);

const METHOD_MAP: Record<HttpMethod, 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options'> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch',
  OPTIONS: 'options',
};

function joinPaths(basePath: string, routePath: string): string {
  const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const route = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return route === '/' ? base || '/' : `${base}${route}`;
}

function defaultResponses(route: RouteMetadata): Record<number, { description: string; content?: object }> {
  const map: Record<number, { description: string; content?: object }> = {
    400: {
      description: 'Validation error',
      content: { 'application/json': { schema: ApiErrorSchema } },
    },
    401: { description: 'Unauthorized' },
    403: { description: 'Forbidden' },
  };

  if (route.responses) {
    for (const [status, schema] of Object.entries(route.responses)) {
      map[Number(status)] = {
        description: `Response ${status}`,
        content: { 'application/json': { schema } },
      };
    }
  } else {
    map[200] = {
      description: 'Success',
      content: { 'application/json': { schema: ApiEnvelopeSchema } },
    };
  }

  return map;
}

export interface GenerateOpenApiOptions {
  title?: string;
  version?: string;
  description?: string;
  servers?: Array<{ url: string; description?: string }>;
}

export function generateFromRouteRegistry(
  options: GenerateOpenApiOptions = {}
): ReturnType<OpenApiGeneratorV3['generateDocument']> {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  registry.register('ApiEnvelope', ApiEnvelopeSchema);
  registry.register('ApiError', ApiErrorSchema);

  for (const [controllerName, controller] of routeRegistry.getControllers()) {
    const meta = routeRegistry.getControllerMetadata(controller);
    if (!meta) continue;

    const routes: RouteMetadata[] =
      Reflect.getMetadata(METADATA_KEYS.ROUTES, controller.prototype) || [];

    for (const route of routes) {
      const fullPath = joinPaths(meta.basePath, route.path);
      const method = METHOD_MAP[route.method];
      if (!method || method === 'options') continue;

      const isPublic = route.openapi?.public === true;

      registry.registerPath({
        method,
        path: fullPath,
        tags: route.openapi?.tags,
        summary: route.openapi?.summary,
        operationId:
          route.openapi?.operationId || `${controllerName}.${String(route.methodName)}`,
        security: isPublic ? [] : [{ bearerAuth: [] }],
        request: {
          ...(route.bodySchema
            ? {
                body: {
                  content: { 'application/json': { schema: route.bodySchema } },
                  required: true,
                },
              }
            : {}),
          ...(route.querySchema ? { query: route.querySchema as never } : {}),
        },
        responses: defaultResponses(route),
      });
    }
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: options.title ?? 'ForgeArc API',
      version: options.version ?? '0.1.0',
      description: options.description,
    },
    servers: options.servers ?? [{ url: 'http://localhost:4000', description: 'Express dev server' }],
  });
}
