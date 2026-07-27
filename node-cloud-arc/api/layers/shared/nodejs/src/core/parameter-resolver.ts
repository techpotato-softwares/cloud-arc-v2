import { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda';
import { ParamMetadata, ParamType, METADATA_KEYS } from '../decorators/metadata';

export interface RequestContext {
  event: APIGatewayProxyEvent;
  context: LambdaContext;
  pathParams: Record<string, string>;
}

/**
 * Resolves parameter values for controller method invocation
 */
export class ParameterResolver {
  /**
   * Resolve all parameters for a controller method
   */
  resolveParameters(
    controller: object,
    methodName: string | symbol,
    requestContext: RequestContext
  ): unknown[] {
    // Get parameter metadata
    const allParams: ParamMetadata[] =
      Reflect.getMetadata(METADATA_KEYS.PARAMS, Object.getPrototypeOf(controller)) || [];

    const methodParams = allParams
      .filter((p) => p.propertyKey === methodName)
      .sort((a, b) => a.index - b.index);

    if (methodParams.length === 0) {
      return [];
    }

    // Determine the max parameter index
    const maxIndex = Math.max(...methodParams.map((p) => p.index));
    const args: unknown[] = new Array(maxIndex + 1).fill(undefined);

    for (const param of methodParams) {
      args[param.index] = this.resolveParameter(param, requestContext);
    }

    return args;
  }

  /**
   * Resolve a single parameter value
   */
  private resolveParameter(param: ParamMetadata, ctx: RequestContext): unknown {
    switch (param.type) {
      case ParamType.PARAM:
        return this.resolvePathParam(param.name!, ctx);

      case ParamType.QUERY:
        return this.resolveQueryParam(param.name!, ctx);

      case ParamType.BODY:
        return this.resolveBody(ctx);

      case ParamType.EVENT:
        return ctx.event;

      case ParamType.CONTEXT:
        return ctx.context;

      case ParamType.HEADERS:
        return this.resolveHeaders(param.name, ctx);

      case ParamType.USER:
        return this.resolveUser(ctx);

      default:
        return undefined;
    }
  }

  /**
   * Extract path parameter from URL
   */
  private resolvePathParam(name: string, ctx: RequestContext): string | undefined {
    // First check our extracted pathParams
    if (ctx.pathParams[name]) {
      return ctx.pathParams[name];
    }
    // Fallback to API Gateway's pathParameters
    return ctx.event.pathParameters?.[name];
  }

  /**
   * Extract query parameter from URL
   */
  private resolveQueryParam(name: string, ctx: RequestContext): string | undefined {
    return ctx.event.queryStringParameters?.[name];
  }

  /**
   * Parse JSON body
   */
  private resolveBody(ctx: RequestContext): unknown {
    if (!ctx.event.body) {
      return undefined;
    }

    try {
      // Handle base64 encoded bodies
      const body = ctx.event.isBase64Encoded
        ? Buffer.from(ctx.event.body, 'base64').toString('utf-8')
        : ctx.event.body;

      return JSON.parse(body);
    } catch {
      // Return raw body if JSON parse fails
      return ctx.event.body;
    }
  }

  /**
   * Extract headers (all or specific)
   */
  private resolveHeaders(name: string | undefined, ctx: RequestContext): unknown {
    const headers = ctx.event.headers || {};

    if (name) {
      // Return specific header (case-insensitive)
      const lowerName = name.toLowerCase();
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerName) {
          return value;
        }
      }
      return undefined;
    }

    return headers;
  }

  /**
   * Extract authenticated user from event (populated by authMiddleware)
   */
  private resolveUser(ctx: RequestContext): unknown {
    // The event is cast to AuthenticatedEvent by the router after auth middleware
    const authenticatedEvent = ctx.event as APIGatewayProxyEvent & { user?: unknown };
    return authenticatedEvent.user;
  }
}

// Export singleton instance
export const parameterResolver = new ParameterResolver();
