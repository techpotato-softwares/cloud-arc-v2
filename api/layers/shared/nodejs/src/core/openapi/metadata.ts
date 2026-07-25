import type { ZodTypeAny } from 'zod';
import { METADATA_KEYS, RouteMetadata } from '../../decorators/metadata';

export const OPENAPI_PENDING_KEY = 'custom:openapi_pending';

export type OpenApiPendingPatch = Partial<
  Pick<
    RouteMetadata,
    'bodySchema' | 'querySchema' | 'responses' | 'openapi' | 'permissions' | 'requiredModule'
  >
>;

export function setOpenApiPending(
  target: object,
  propertyKey: string | symbol,
  patch: OpenApiPendingPatch
): void {
  const pending: Record<string | symbol, OpenApiPendingPatch> =
    Reflect.getMetadata(OPENAPI_PENDING_KEY, target) || {};
  pending[propertyKey] = { ...pending[propertyKey], ...patch };
  Reflect.defineMetadata(OPENAPI_PENDING_KEY, pending, target);
}

/** Called from HTTP decorators after the route row is created. */
export function applyOpenApiPending(prototype: object, route: RouteMetadata): void {
  const pending: Record<string | symbol, OpenApiPendingPatch> =
    Reflect.getMetadata(OPENAPI_PENDING_KEY, prototype) || {};
  const patch = pending[route.propertyKey];
  if (!patch) return;

  if (patch.bodySchema) route.bodySchema = patch.bodySchema;
  if (patch.querySchema) route.querySchema = patch.querySchema;
  if (patch.responses) route.responses = { ...route.responses, ...patch.responses };
  if (patch.openapi) route.openapi = { ...route.openapi, ...patch.openapi };
  if (patch.permissions) route.permissions = patch.permissions;
  if (patch.requiredModule) route.requiredModule = patch.requiredModule;
}
