import 'reflect-metadata';
import { METADATA_KEYS, HttpMethod, RouteMetadata, addToMetadataArray } from './metadata';
import { applyOpenApiPending } from '../core/openapi/metadata';

/**
 * Factory for creating HTTP method decorators
 */
function createMethodDecorator(method: HttpMethod) {
  return function (path: string = '/'): MethodDecorator {
    return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
      const routeMetadata: RouteMetadata = {
        method,
        path,
        methodName: String(propertyKey),
        propertyKey,
      };

      applyOpenApiPending(target, routeMetadata);

      // Add route to the controller's routes array
      addToMetadataArray(METADATA_KEYS.ROUTES, target, routeMetadata);

      return descriptor;
    };
  };
}

/**
 * GET request decorator
 * @example
 * @Get('/')
 * async getAll() { }
 *
 * @Get('/{id}')
 * async getById(@Param('id') id: string) { }
 */
export const Get = createMethodDecorator('GET');

/**
 * POST request decorator
 * @example
 * @Post('/')
 * async create(@Body() data: CreateRequest) { }
 */
export const Post = createMethodDecorator('POST');

/**
 * PUT request decorator
 * @example
 * @Put('/{id}')
 * async update(@Param('id') id: string, @Body() data: UpdateRequest) { }
 */
export const Put = createMethodDecorator('PUT');

/**
 * DELETE request decorator
 * @example
 * @Delete('/{id}')
 * async delete(@Param('id') id: string) { }
 */
export const Delete = createMethodDecorator('DELETE');

/**
 * PATCH request decorator
 * @example
 * @Patch('/{id}')
 * async patch(@Param('id') id: string, @Body() data: PatchRequest) { }
 */
export const Patch = createMethodDecorator('PATCH');

/**
 * OPTIONS request decorator (for custom CORS handling)
 * @example
 * @Options('/')
 * async options() { }
 */
export const Options = createMethodDecorator('OPTIONS');
