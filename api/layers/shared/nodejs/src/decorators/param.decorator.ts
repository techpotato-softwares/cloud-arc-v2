import 'reflect-metadata';
import { METADATA_KEYS, ParamType, ParamMetadata, addToMetadataArray } from './metadata';

/**
 * Factory for creating parameter decorators
 */
function createParamDecorator(type: ParamType, name?: string): ParameterDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    if (propertyKey === undefined) return;

    const paramMetadata: ParamMetadata = {
      type,
      name,
      index: parameterIndex,
      propertyKey,
    };

    addToMetadataArray(METADATA_KEYS.PARAMS, target, paramMetadata);
  };
}

/**
 * Path parameter decorator - extracts value from URL path
 * @example
 * @Get('/{id}')
 * async getById(@Param('id') id: string) { }
 *
 * @Get('/{userId}/orders/{orderId}')
 * async getOrder(@Param('userId') userId: string, @Param('orderId') orderId: string) { }
 */
export function Param(name: string): ParameterDecorator {
  return createParamDecorator(ParamType.PARAM, name);
}

/**
 * Query parameter decorator - extracts value from query string
 * @example
 * @Get('/')
 * async getAll(@Query('page') page: number, @Query('limit') limit: number) { }
 *
 * @Get('/search')
 * async search(@Query('q') query: string) { }
 */
export function Query(name: string): ParameterDecorator {
  return createParamDecorator(ParamType.QUERY, name);
}

/**
 * Request body decorator - parses JSON body
 * @example
 * @Post('/')
 * async create(@Body() data: CreateRequest) { }
 */
export function Body(): ParameterDecorator {
  return createParamDecorator(ParamType.BODY);
}

/**
 * Raw event decorator - injects the full APIGatewayProxyEvent
 * @example
 * @Post('/')
 * async create(@Event() event: APIGatewayProxyEvent) { }
 */
export function Event(): ParameterDecorator {
  return createParamDecorator(ParamType.EVENT);
}

/**
 * Lambda context decorator - injects the Lambda Context
 * @example
 * @Get('/')
 * async get(@Context() ctx: LambdaContext) { }
 */
export function Context(): ParameterDecorator {
  return createParamDecorator(ParamType.CONTEXT);
}

/**
 * Headers decorator - injects all headers or a specific header
 * @example
 * @Get('/')
 * async get(@Headers() headers: Record<string, string>) { }
 *
 * @Get('/')
 * async get(@Headers('authorization') auth: string) { }
 */
export function Headers(name?: string): ParameterDecorator {
  return createParamDecorator(ParamType.HEADERS, name);
}

/**
 * Current user decorator - injects the authenticated user from JWT token
 * @example
 * @Post('/')
 * async create(@Body() data: CreateRequest, @CurrentUser() user: JWTPayload) {
 *   const enrichedData = { ...data, createdById: user.userId };
 * }
 */
export function CurrentUser(): ParameterDecorator {
  return createParamDecorator(ParamType.USER);
}
