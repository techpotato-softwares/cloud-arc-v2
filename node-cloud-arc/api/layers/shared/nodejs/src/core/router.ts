import 'reflect-metadata';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context as LambdaContext } from 'aws-lambda';
import { Container } from 'inversify';
import { routeRegistry } from '../decorators/registry';
import { RouteMetadata, HttpMethod } from '../decorators/metadata';
import { parameterResolver, RequestContext } from './parameter-resolver';
import {
  createSuccessResponse,
  createErrorResponse,
  handleOptions,
  ValidationError,
  ForbiddenError,
} from '../middleware/errorHandler';
import { authMiddleware, AuthenticatedEvent } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { validateRouteInput } from './openapi/validation';
import type { JWTPayload } from '../utils/webtoken';

interface MatchedRoute {
  controller: Function;
  route: RouteMetadata;
  pathParams: Record<string, string>;
  basePath: string;
}
const PUBLIC_ROUTES: Array<{ method: HttpMethod; path: string }> = [
  { method: 'POST', path: '/api/login' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'GET', path: '/health' },
];

function assertPermissions(user: JWTPayload | undefined, required?: string[]): void {
  if (!required || required.length === 0) return;
  const owned = new Set(user?.permissions || []);
  const ok = required.some((code) => owned.has(code));
  if (!ok) {
    throw new ForbiddenError(`Missing required permission: ${required.join(' | ')}`);
  }
}

function assertModule(user: JWTPayload | undefined, sku?: string): void {
  if (!sku) return;
  const enabled = user?.modulesEnabled || ['platform', 'demo', 'ai', 'files'];
  if (!enabled.includes(sku)) {
    throw new ForbiddenError(`Module '${sku}' is not enabled for this tenant`);
  }
}
export class Router {
  private container: Container;
  private lambdaName: string;

  constructor(container: Container, lambdaName: string) {
    this.container = container;
    this.lambdaName = lambdaName;
  }

  private isPublicRoute(method: HttpMethod, path: string, route?: RouteMetadata): boolean {
    if (route?.openapi?.public) {
      return true;
    }
    // Normalize paths by removing trailing slashes for comparison
    const normalizePath = (p: string): string =>
      p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p;
    const normalizedPath = normalizePath(path);

    return PUBLIC_ROUTES.some(
      (route) => route.method === method && normalizePath(route.path) === normalizedPath
    );
  }
  async handleRequest(
    event: APIGatewayProxyEvent,
    context: LambdaContext
  ): Promise<APIGatewayProxyResult> {
    const method = event.httpMethod.toUpperCase() as HttpMethod;
    const path = event.path;

    if (method === 'OPTIONS') {
      return handleOptions();
    }

    try {
      const match = this.matchRoute(method, path);

      if (!match) {
        logger.warn('No route matched', { method, path });
        return createErrorResponse(new ValidationError(`No route found for ${method} ${path}`));
      }

      logger.debug('Route matched', {
        controller: match.controller.name,
        method: match.route.methodName,
        pathParams: match.pathParams,
        path,
      });
      validateRouteInput(match.route, event);

      let authenticatedEvent: AuthenticatedEvent | APIGatewayProxyEvent = event;
      if (!this.isPublicRoute(method, path, match.route)) {
        logger.debug('Route requires authentication', { method, path });

        const authResult = await authMiddleware(event);
        if ('statusCode' in authResult && 'body' in authResult) {
          logger.warn('Authentication failed', { method, path, statusCode: authResult.statusCode });
          return authResult;
        }

        authenticatedEvent = authResult as AuthenticatedEvent;
        logger.debug('Authentication successful', {
          username: (authenticatedEvent as AuthenticatedEvent).user?.username,
          method,
          path,
        });

        const user = (authenticatedEvent as AuthenticatedEvent).user;
        assertPermissions(user, match.route.permissions);
        assertModule(user, match.route.requiredModule);
      } else {
        logger.debug('Public route - skipping authentication', { method, path });
      }

      const controllerInstance = this.container.get(match.controller) as object;

      const requestContext: RequestContext = {
        event: authenticatedEvent,
        context,
        pathParams: match.pathParams,
      };

      const args = parameterResolver.resolveParameters(
        controllerInstance,
        match.route.propertyKey,
        requestContext
      );

      const methodFn = (controllerInstance as Record<string | symbol, Function>)[
        match.route.propertyKey
      ];
      const result = await methodFn.apply(controllerInstance, args);

      if (this.isApiGatewayResponse(result)) {
        return result;
      }

      return createSuccessResponse(result);
    } catch (error) {
      const errorObj = error as Error & { code?: string; meta?: unknown };
      const isPrismaError = errorObj.name?.startsWith('PrismaClient');

      if (isPrismaError) {
        logger.error('Error handling request', {
          type: errorObj.name,
          code: errorObj.code,
          meta: errorObj.meta,
          message: errorObj.message?.substring(0, 200) || 'No message',
        });
      } else {
        logger.error('Error handling request', {
          name: errorObj.name,
          message: errorObj.message?.substring(0, 500) || 'No message',
          stack: errorObj.stack?.split('\n').slice(0, 10).join('\n') || undefined,
        });
      }

      return createErrorResponse(error as Error);
    }
  }

  private matchRoute(method: HttpMethod, path: string): MatchedRoute | null {
    const controllerData = routeRegistry.getRoutesForLambda(this.lambdaName);

    logger.debug('Matching route', {
      lambdaName: this.lambdaName,
      method,
      path,
      controllerCount: controllerData.length,
    });

    // Flatten all routes for this method, then sort so literal paths are tried
    // before parameterized ones (e.g. /api/po/summary before /api/po/{id})
    type RouteCandidate = { controller: Function; route: RouteMetadata; basePath: string };
    const candidates: RouteCandidate[] = [];
    for (const { controller, routes, basePath } of controllerData) {
      for (const route of routes) {
        if (route.method === method) {
          candidates.push({ controller, route, basePath });
        }
      }
    }
    candidates.sort((a, b) => {
      const pathA = this.joinPaths(a.basePath, a.route.path);
      const pathB = this.joinPaths(b.basePath, b.route.path);
      const aHasParam = pathA.includes('{');
      const bHasParam = pathB.includes('{');
      if (aHasParam === bHasParam) return 0;
      return aHasParam ? 1 : -1; // literal first
    });

    for (const { controller, route, basePath } of candidates) {
      const fullPath = this.joinPaths(basePath, route.path);
      logger.debug('Trying to match route', {
        fullPath,
        actualPath: path,
        routeMethod: route.method,
      });

      const pathParams = this.matchPath(fullPath, path);

      if (pathParams !== null) {
        logger.debug('Route matched', { fullPath, path, pathParams });
        return { controller, route, pathParams, basePath };
      }
    }

    logger.warn('No route matched', {
      lambdaName: this.lambdaName,
      method,
      path,
      availableRoutes: controllerData.flatMap(({ routes, basePath }) =>
        routes.map((r) => `${r.method} ${this.joinPaths(basePath, r.path)}`)
      ),
    });

    return null;
  }
  private matchPath(pattern: string, actualPath: string): Record<string, string> | null {
    // Normalize paths by removing trailing slashes (except root)
    const normalizePath = (p: string): string =>
      p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p;
    const normalizedPattern = normalizePath(pattern);
    const normalizedActual = normalizePath(actualPath);

    const patternParts = normalizedPattern.split('/').filter(Boolean);
    const actualParts = normalizedActual.split('/').filter(Boolean);

    if (patternParts.length !== actualParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const actualPart = actualParts[i];
      const paramMatch = patternPart.match(/^\{(\w+)\}$/);

      if (paramMatch) {
        params[paramMatch[1]] = decodeURIComponent(actualPart);
      } else if (patternPart !== actualPart) {
        return null;
      }
    }

    return params;
  }

  private joinPaths(basePath: string, routePath: string): string {
    const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    const route = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return route === '/' ? base || '/' : `${base}${route}`;
  }

  private isApiGatewayResponse(result: unknown): result is APIGatewayProxyResult {
    return (
      typeof result === 'object' && result !== null && 'statusCode' in result && 'body' in result
    );
  }
}

export function createRouter(container: Container, lambdaName: string): Router {
  return new Router(container, lambdaName);
}
