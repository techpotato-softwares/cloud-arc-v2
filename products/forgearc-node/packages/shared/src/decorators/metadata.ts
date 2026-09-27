import 'reflect-metadata';
import type { ZodTypeAny } from 'zod';

// Metadata keys for decorators
export const METADATA_KEYS = {
  CONTROLLER: 'custom:controller',
  ROUTES: 'custom:routes',
  PARAMS: 'custom:params',
  CONTROLLER_NAME: 'custom:controller_name',
  LAMBDA_NAME: 'custom:lambda_name',
} as const;

// HTTP methods supported
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

// Route metadata structure
export interface RouteMetadata {
  method: HttpMethod;
  path: string;
  methodName: string;
  propertyKey: string | symbol;
  bodySchema?: ZodTypeAny;
  querySchema?: ZodTypeAny;
  responses?: Record<number, ZodTypeAny>;
  openapi?: {
    summary?: string;
    tags?: string[];
    operationId?: string;
    public?: boolean;
  };
  /** Permission codes required (any-of). Enforced by Router after JWT auth. */
  permissions?: string[];
  /** Module SKU that must be enabled on the tenant. */
  requiredModule?: string;
}

// Parameter types for injection
export enum ParamType {
  PARAM = 'param', // Path parameter
  QUERY = 'query', // Query string parameter
  BODY = 'body', // Request body
  EVENT = 'event', // Raw APIGatewayProxyEvent
  CONTEXT = 'context', // Lambda Context
  HEADERS = 'headers', // Request headers
  USER = 'user', // Authenticated user from JWT
}

// Parameter metadata structure
export interface ParamMetadata {
  type: ParamType;
  name?: string; // Parameter name (for @Param, @Query)
  index: number; // Argument index in function
  propertyKey: string | symbol;
  required?: boolean;
  transform?: (value: unknown) => unknown;
}

// Controller metadata structure
export interface ControllerMetadata {
  basePath: string;
  controllerName: string;
  lambdaName?: string;
}

// Manifest structures
export interface RouteManifestEntry {
  method: HttpMethod;
  path: string;
  controller: string;
  action: string;
}

export interface LambdaManifestEntry {
  handler: string;
  controller: string;
  routes: RouteManifestEntry[];
}

export interface AppManifest {
  version: string;
  generatedAt: string;
  lambdas: Record<string, LambdaManifestEntry>;
}

// Helper to get or initialize metadata array
export function getMetadataArray<T>(key: string, target: object): T[] {
  if (!Reflect.hasMetadata(key, target)) {
    Reflect.defineMetadata(key, [], target);
  }
  return Reflect.getMetadata(key, target) as T[];
}

// Helper to add to metadata array
export function addToMetadataArray<T>(key: string, target: object, item: T): void {
  const array = getMetadataArray<T>(key, target);
  array.push(item);
  Reflect.defineMetadata(key, array, target);
}
