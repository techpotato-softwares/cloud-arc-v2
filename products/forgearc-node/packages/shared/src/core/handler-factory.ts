import 'reflect-metadata';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { lambdaRegistry } from './service-registry';
import { Router, createRouter } from './router';
import { logger } from '../utils/logger';
import { createErrorResponse, handleOptions } from '../middleware/errorHandler';

/**
 * DI containers and routers are cached at module scope (see ../DI.md in layers/shared).
 * initializeLambda() runs once per Lambda cold start; warm invocations reuse handlerStates.
 */

/**
 * Handler state for a specific lambda
 */
interface HandlerState {
  isInitialized: boolean;
  initPromise: Promise<void> | null;
  initError: Error | null;
  router: Router | null;
}

// Cache handler state per lambda (for warm starts)
const handlerStates: Map<string, HandlerState> = new Map();

/**
 * Get or create handler state for a lambda
 */
function getHandlerState(lambdaName: string): HandlerState {
  let state = handlerStates.get(lambdaName);
  if (!state) {
    state = {
      isInitialized: false,
      initPromise: null,
      initError: null,
      router: null,
    };
    handlerStates.set(lambdaName, state);
  }
  return state;
}

/**
 * Initialize a lambda handler
 */
async function initializeLambda(lambdaName: string): Promise<Router> {
  const state = getHandlerState(lambdaName);

  // Fast path: already initialized
  if (state.isInitialized && state.router) {
    return state.router;
  }

  // If previous initialization failed, throw the error
  if (state.initError) {
    throw state.initError;
  }

  // If initialization is in progress, wait for it
  if (state.initPromise) {
    await state.initPromise;
    if (state.router) {
      return state.router;
    }
    throw new Error('Initialization completed but router not available');
  }

  // Start new initialization
  state.initPromise = (async () => {
    const startTime = Date.now();
    logger.info(`Initializing Lambda '${lambdaName}' container and DB connection...`);

    try {
      // Get DI container from registry (handles DB connection, model init, bindings)
      const container = await lambdaRegistry.getContainer(lambdaName);

      // Create router for this lambda
      state.router = createRouter(container, lambdaName);
      state.isInitialized = true;

      const duration = Date.now() - startTime;
      logger.info(`Lambda '${lambdaName}' initialized in ${duration}ms`);
    } catch (error) {
      state.initError = error as Error;
      throw error;
    }
  })();

  await state.initPromise;

  if (!state.router) {
    throw new Error('Router not initialized after initialization');
  }

  return state.router;
}

/**
 * AWS Lambda handler type
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

/**
 * Create a Lambda handler for a registered lambda configuration.
 *
 * This is the main factory function that creates a fully configured Lambda handler.
 * It handles:
 * - Cold start initialization with connection reuse
 * - DI container creation with auto-wiring
 * - Request routing to controllers
 * - Error handling and CORS
 *
 * @param lambdaName - Name of the lambda (must be registered with defineLambda)
 * @returns Lambda handler function
 *
 * @example
 * ```typescript
 * // src/lambdas/po.lambda.ts
 * import { defineLambda, createLambdaHandler } from '@forgearc/shared';
 * import { TYPES } from '../types/types';
 * import { POController } from '../controllers/POController';
 * import { POService } from '../services/POService';
 * import { PORepository } from '../repositories/PORepository';
 * import { initializeModels } from '../models';
 *
 * // Register lambda configuration
 * defineLambda({
 *   name: 'po',
 *   controller: POController,
 *   bindings: [
 *     { symbol: TYPES.POService, implementation: POService },
 *     { symbol: TYPES.PORepository, implementation: PORepository },
 *   ],
 *   initModels: initializeModels,
 * });
 *
 * // Export the handler
 * export const handler = createLambdaHandler('po');
 * ```
 */
export function createLambdaHandler(lambdaName: string): LambdaHandler {
  // Trigger initialization on cold start (outside handler)
  // This runs when the module is first imported
  initializeLambda(lambdaName).catch((error) => {
    logger.error(`Failed to initialize '${lambdaName}' during cold start`, error);
  });

  // Return the actual handler function
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    context.callbackWaitsForEmptyEventLoop = false;

    // Handle warmup events (from CloudWatch Events, serverless-plugin-warmup, or custom warmup)
    // This keeps Lambda warm without executing business logic or DB connections
    const eventSource = (event as unknown as { source?: string }).source;
    if (
      eventSource === 'serverless-plugin-warmup' ||
      eventSource === 'aws.events' ||
      event.headers?.['X-Warmup'] === 'true' ||
      event.headers?.['x-warmup'] === 'true'
    ) {
      logger.debug('Warmup event received, skipping initialization');
      return { statusCode: 200, headers: {}, body: 'OK' };
    }

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return handleOptions();
    }

    const rid =
      event.headers?.['X-Request-Id'] ||
      event.headers?.['x-request-id'] ||
      context.awsRequestId;

    // Set logging context
    logger.setContext({
      requestId: String(rid),
      functionName: context.functionName,
      lambdaName,
    });

    const startTime = Date.now();
    logger.info('Incoming request', {
      method: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
    });

    try {
      // Ensure initialization is complete
      const router = await initializeLambda(lambdaName);

      // Route the request
      const response = await router.handleRequest(event, context);
      response.headers = { ...response.headers, 'X-Request-Id': String(rid) };

      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        statusCode: response.statusCode,
        duration: `${duration}ms`,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Unhandled error in handler', { error, duration: `${duration}ms` });
      const errRes = createErrorResponse(error as Error);
      errRes.headers = { ...errRes.headers, 'X-Request-Id': String(rid) };
      return errRes;
    } finally {
      logger.clearContext();
    }
  };
}

/**
 * Reset handler state for a lambda (useful for testing)
 */
export function resetHandlerState(lambdaName: string): void {
  handlerStates.delete(lambdaName);
  lambdaRegistry.resetContainer(lambdaName);
}

/**
 * Clear all handler states (useful for testing)
 */
export function clearAllHandlerStates(): void {
  handlerStates.clear();
  lambdaRegistry.clear();
}
