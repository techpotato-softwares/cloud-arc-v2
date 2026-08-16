/**
 * Express Development Server
 *
 * Runs the API locally without Docker/SAM for fastest development experience.
 * Provides instant responses (~10-50ms) vs Lambda cold starts (~5-10s).
 *
 * Usage:
 *   npm run dev:express        # Start Express server on port 4000
 *   API_PORT=5000 npm run dev:express  # Custom port
 *
 * Note: This bypasses Lambda environment. Use SAM for Lambda-specific testing.
 */

import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

type RequestWithRawBody = Request & { rawBody?: Buffer };

// Load environment variables from env.local.json (same as SAM uses)
function loadEnvFromLocalJson(): void {
  const envLocalPath = path.join(__dirname, '../../cdk/env.local.json');

  if (fs.existsSync(envLocalPath)) {
    try {
      const envConfig = JSON.parse(fs.readFileSync(envLocalPath, 'utf-8'));
      // Get the first key (e.g., "arcforge-po-dev") and load its values
      const firstKey = Object.keys(envConfig)[0];
      if (firstKey && envConfig[firstKey]) {
        const vars = envConfig[firstKey];
        for (const [key, value] of Object.entries(vars)) {
          if (typeof value === 'string' && !process.env[key]) {
            process.env[key] = value;
          }
        }
        console.log(`📂 Loaded environment from: cdk/env.local.json (${firstKey})`);
      }
    } catch (error) {
      console.warn('⚠️  Could not parse env.local.json:', (error as Error).message);
    }
  } else {
    console.warn('⚠️  env.local.json not found. Copy cdk/env.template.json to cdk/env.local.json');
  }

  // Ensure IS_LOCAL is set for local development
  process.env.IS_LOCAL = 'true';
}

// Load environment variables before importing lambdas
loadEnvFromLocalJson();

// Platform module (auth, user, role, permission)
import '../modules/platform/lambdas/auth.lambda';
import '../modules/platform/lambdas/user.lambda';
import '../modules/platform/lambdas/role.lambda';
import '../modules/platform/lambdas/permission.lambda';

// Demo + AI modules
import '../modules/demo/lambdas/demo.lambda';
import '../modules/ai/lambdas/ai.lambda';
import '../modules/files/lambdas/files.lambda';

// Import shared utilities
import { lambdaRegistry, routeRegistry, Router, createRouter } from '@arcforge/shared';

const PORT = process.env.API_PORT || process.env.PORT || 4000;

/**
 * Convert Express request to API Gateway event format
 */
function expressToApiGatewayEvent(req: Request): APIGatewayProxyEvent {
  const r = req as RequestWithRawBody;
  const hasRawBody = !!r.rawBody && r.rawBody.length > 0;
  return {
    httpMethod: req.method,
    path: req.path,
    headers: req.headers as Record<string, string>,
    queryStringParameters: req.query as Record<string, string>,
    pathParameters: req.params,
    body: hasRawBody ? r.rawBody!.toString('base64') : req.body ? JSON.stringify(req.body) : null,
    isBase64Encoded: hasRawBody,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      authorizer: null,
      httpMethod: req.method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: req.ip || '127.0.0.1',
        user: null,
        userAgent: req.get('user-agent') || null,
        userArn: null,
      },
      path: req.path,
      protocol: 'HTTP/1.1',
      requestId: `local-${Date.now()}`,
      requestTimeEpoch: Date.now(),
      resourceId: 'local',
      resourcePath: req.path,
      stage: 'local',
    },
    resource: req.path,
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
  } as APIGatewayProxyEvent;
}

/**
 * Create a mock Lambda context
 */
function createMockContext(): Context {
  const requestId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  return {
    awsRequestId: requestId,
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'local-dev',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:local:123456789:function:local-dev',
    logGroupName: '/aws/lambda/local-dev',
    logStreamName: `${new Date().toISOString().split('T')[0]}/${requestId}`,
    memoryLimitInMB: '256',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

async function startServer() {
  console.log('\n🚀 Express Development Server\n');
  console.log('='.repeat(50));

  const startTime = Date.now();
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Capture raw body for multipart and text/csv so we can forward exact bytes to the lambda router.
  // Without this, Express parsers drop/alter the body and Busboy will fail with "Unexpected end of form".
  app.use((req: Request, res: Response, next: NextFunction) => {
    const r = req as RequestWithRawBody;
    const ct = (req.headers['content-type'] || '').toString().toLowerCase();
    const shouldCapture =
      ct.includes('multipart/form-data') ||
      ct.includes('text/csv') ||
      ct.includes('application/csv');

    if (!shouldCapture) return next();

    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      r.rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      console.log(`${color}${req.method}\x1b[0m ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', mode: 'express-dev', timestamp: new Date().toISOString() });
  });

  // Initialize all routers
  console.log('\n📦 Initializing services...');

  const lambdaNames = lambdaRegistry.getLambdaNames();
  const routers: Map<string, Router> = new Map();

  for (const lambdaName of lambdaNames) {
    try {
      const container = await lambdaRegistry.getContainer(lambdaName);
      const router = createRouter(container, lambdaName);
      routers.set(lambdaName, router);
      console.log(`   ✅ ${lambdaName}`);
    } catch (error) {
      console.error(`   ❌ ${lambdaName}: ${(error as Error).message}`);
    }
  }

  // Collect all routes for display
  console.log('\n📍 Routes:');
  const allRoutes: Array<{ method: string; path: string; lambda: string }> = [];

  for (const lambdaName of lambdaNames) {
    const controllerData = routeRegistry.getRoutesForLambda(lambdaName);
    for (const { routes, basePath } of controllerData) {
      for (const route of routes) {
        const fullPath = basePath + (route.path === '/' ? '' : route.path);
        allRoutes.push({ method: route.method, path: fullPath, lambda: lambdaName });
      }
    }
  }

  // Sort and display routes
  allRoutes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  for (const route of allRoutes) {
    const methodColor =
      {
        GET: '\x1b[32m',
        POST: '\x1b[33m',
        PUT: '\x1b[34m',
        DELETE: '\x1b[31m',
        PATCH: '\x1b[35m',
      }[route.method] || '\x1b[0m';
    console.log(`   ${methodColor}${route.method.padEnd(7)}\x1b[0m ${route.path}`);
  }

  // Catch-all handler that routes to appropriate Lambda router
  app.all('/api/*', async (req: Request, res: Response) => {
    const event = expressToApiGatewayEvent(req);
    const context = createMockContext();

    // Find the right router for this path
    // Check all registered lambdas, not just successfully initialized ones
    for (const lambdaName of lambdaNames) {
      const controllerData = routeRegistry.getRoutesForLambda(lambdaName);

      for (const { routes, basePath } of controllerData) {
        for (const route of routes) {
          const fullPath = basePath + (route.path === '/' ? '' : route.path);

          // Convert path pattern to regex
          const pathRegex = new RegExp('^' + fullPath.replace(/\{(\w+)\}/g, '([^/]+)') + '$');

          if (route.method === req.method && pathRegex.test(req.path)) {
            // Get or create router for this lambda (may need to initialize)
            let router = routers.get(lambdaName);
            if (!router) {
              try {
                const container = await lambdaRegistry.getContainer(lambdaName);
                router = createRouter(container, lambdaName);
                routers.set(lambdaName, router);
              } catch (error) {
                console.error(`Failed to initialize router for ${lambdaName}:`, error);
                res.status(500).json({
                  error: 'Internal Server Error',
                  message: `Failed to initialize service: ${(error as Error).message}`,
                });
                return;
              }
            }

            // Extract path parameters
            const match = req.path.match(pathRegex);
            if (match) {
              const paramNames = [...fullPath.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
              const pathParams: Record<string, string> = {};
              paramNames.forEach((name, i) => {
                pathParams[name] = match[i + 1];
              });
              event.pathParameters = pathParams;
            }

            try {
              const result = await router.handleRequest(event, context);

              // Set response headers
              if (result.headers) {
                Object.entries(result.headers).forEach(([key, value]) => {
                  if (value) res.setHeader(key, String(value));
                });
              }

              res.status(result.statusCode);

              // Parse body if it's JSON
              try {
                const body = JSON.parse(result.body);
                res.json(body);
              } catch {
                res.send(result.body);
              }
              return;
            } catch (error) {
              console.error('Handler error:', error);
              res.status(500).json({
                error: 'Internal Server Error',
                message: (error as Error).message,
              });
              return;
            }
          }
        }
      }
    }

    // No route matched
    res.status(404).json({
      error: 'Not Found',
      message: `No route found for ${req.method} ${req.path}`,
    });
  });

  // 404 handler for non-API routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found. API routes start with /api/`,
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('Express error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  });

  // Start server
  app.listen(PORT, () => {
    const duration = Date.now() - startTime;
    console.log('\n' + '='.repeat(50));
    console.log(`\n✨ Server ready in ${duration}ms`);
    console.log(`\n🌐 http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log('\n💡 Tips:');
    console.log('   - Responses are instant (~10-50ms)');
    console.log('   - Edit code → save → changes are live (with nodemon)');
    console.log('   - Use SAM for Lambda-specific testing');
    console.log('   - Press Ctrl+C to stop\n');
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down Express server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
