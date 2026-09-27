// Metadata types and keys
export * from './metadata';

// Route registry
export { routeRegistry } from './registry';

// Controller decorator
export { Controller, ControllerOptions } from './controller.decorator';

// HTTP method decorators
export { Get, Post, Put, Delete, Patch, Options } from './http.decorator';

// Parameter decorators
export { Param, Query, Body, Event, Context, Headers, CurrentUser } from './param.decorator';

// OpenAPI / Zod route metadata
export {
  ApiBody,
  ApiQuery,
  OpenApiResponse,
  ApiTags,
  ApiOperation,
  ApiPublic,
  RequirePermission,
  RequireModule,
} from '../core/openapi/decorators';
