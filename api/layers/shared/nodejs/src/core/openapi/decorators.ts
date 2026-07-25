import type { ZodTypeAny } from 'zod';
import { METADATA_KEYS, RouteMetadata } from '../../decorators/metadata';
import { setOpenApiPending } from './metadata';

type OpenApiRoutePatch = Partial<
  Pick<
    RouteMetadata,
    'bodySchema' | 'querySchema' | 'responses' | 'openapi' | 'permissions' | 'requiredModule'
  >
>;

function mergeResponses(
  target: object,
  propertyKey: string | symbol,
  status: number,
  schema: ZodTypeAny
): void {
  const pending: Record<string | symbol, OpenApiRoutePatch> =
    Reflect.getMetadata('custom:openapi_pending', target) || {};
  const existing = pending[propertyKey]?.responses || {};
  setOpenApiPending(target, propertyKey, {
    responses: { ...existing, [status]: schema },
  });
}

export function ApiBody(schema: ZodTypeAny) {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    setOpenApiPending(target, propertyKey, { bodySchema: schema });
  };
}

export function ApiQuery(schema: ZodTypeAny) {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    setOpenApiPending(target, propertyKey, { querySchema: schema });
  };
}

/** Attach a Zod response schema for OpenAPI generation. */
export function OpenApiResponse(status: number, schema: ZodTypeAny) {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    mergeResponses(target, propertyKey, status, schema);
  };
}

export function ApiTags(...tags: string[]) {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    setOpenApiPending(target, propertyKey, { openapi: { tags } });
  };
}

export function ApiOperation(options: { summary?: string; operationId?: string }) {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    setOpenApiPending(target, propertyKey, { openapi: options });
  };
}

/** Skip JWT for this route (login, refresh). */
export function ApiPublic() {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    setOpenApiPending(target, propertyKey, { openapi: { public: true } });
  };
}

/**
 * Require at least one of the given permission codes on the JWT.
 * Must be placed above the HTTP method decorator (or both above @Get etc. with pending merge).
 */
export function RequirePermission(...codes: string[]) {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    setOpenApiPending(target, propertyKey, { permissions: codes });
  };
}

/** Require tenant.modulesEnabled to include this SKU. */
export function RequireModule(sku: string) {
  return function (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    setOpenApiPending(target, propertyKey, { requiredModule: sku });
  };
}
