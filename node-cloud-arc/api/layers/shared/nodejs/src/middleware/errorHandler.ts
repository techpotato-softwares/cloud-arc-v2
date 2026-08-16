import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  public readonly field?: string;

  constructor(message: string = 'Validation failed', field?: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Pre-computed CORS headers for performance
function allowOrigin(): string {
  const raw = process.env.ALLOWED_ORIGINS || '*';
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.includes('*') || parts.length === 0) return '*';
  return parts[0];
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': allowOrigin(),
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Request-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

// Cache headers for responses
const getCacheHeaders = (maxAge: number = 0): Record<string, string> => {
  if (maxAge > 0) {
    return {
      'Cache-Control': `max-age=${maxAge}, must-revalidate`,
    };
  }
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
};

export const createSuccessResponse = <T>(
  data: T,
  statusCode: number = 200,
  meta?: ApiResponse['meta'],
  cacheMaxAge: number = 0
): APIGatewayProxyResult => {
  // If data is an object (not array or null), spread it directly into response
  // This avoids double nesting with RTK Query which already wraps responses in 'data'
  // For arrays and primitives, wrap them in a data field
  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);

  const response = {
    ...(isObject ? data : {}),
    success: true,
    ...(!isObject && data !== null && data !== undefined ? { data } : {}),
    ...(meta && { meta }),
  };

  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      ...getCacheHeaders(cacheMaxAge),
    },
    body: JSON.stringify(response),
  };
};

/**
 * Format Prisma errors into user-friendly messages
 */
const formatPrismaError = (
  error: Error
): { statusCode: number; code: string; message: string } | null => {
  const errorName = error.name || '';
  const errorMessage = error.message || '';

  // Prisma validation errors (missing required fields, invalid data)
  if (errorName === 'PrismaClientValidationError') {
    // Extract the missing field from the error message
    const missingFieldMatch = errorMessage.match(/Argument `(\w+)` is missing/);
    if (missingFieldMatch) {
      return {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: `Missing required field: ${missingFieldMatch[1]}`,
      };
    }
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid data provided',
    };
  }

  // Prisma known request errors (unique constraint, foreign key, etc.)
  if (errorName === 'PrismaClientKnownRequestError') {
    const prismaError = error as Error & {
      code?: string;
      meta?: {
        modelName?: string;
        target?: string[];
      };
    };

    // Try to extract error code from message if not directly available
    let errorCode = prismaError.code;
    if (!errorCode && errorMessage) {
      // Check if message contains error code pattern like "P2002"
      const codeMatch = errorMessage.match(/\bP\d{4}\b/);
      if (codeMatch) {
        errorCode = codeMatch[0];
      }
    }

    // Try to extract field names from error message if meta is not available
    // Access meta.target directly and create a copy to avoid reference issues
    let fields: string[] = [];
    if (prismaError.meta?.target && Array.isArray(prismaError.meta.target)) {
      fields = [...prismaError.meta.target];
    }

    if (fields.length === 0 && errorMessage) {
      // Extract field names from error message like "Unique constraint failed on the fields: (`username`)"
      const fieldMatch = errorMessage.match(/fields:\s*\(`(\w+)`\)/);
      if (fieldMatch) {
        fields = [fieldMatch[1]];
      }
    }

    switch (errorCode) {
      case 'P2002': // Unique constraint violation
        // Create user-friendly field names
        const fieldNames = fields.map((field) => {
          // Convert snake_case or camelCase to readable format
          return field
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .replace(/^\w/, (c) => c.toUpperCase());
        });

        // Create a more specific message
        let message = 'A record with this value already exists';
        if (fieldNames.length === 1) {
          message = `${fieldNames[0]} already exists`;
        } else if (fieldNames.length > 1) {
          message = `${fieldNames.join(', ')} already exist`;
        }

        return {
          statusCode: 409,
          code: 'DUPLICATE_ERROR',
          message,
        };
      case 'P2003': // Foreign key constraint failed
        return {
          statusCode: 400,
          code: 'REFERENCE_ERROR',
          message: 'Referenced record does not exist',
        };
      case 'P2025': // Record not found
        return {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Record not found',
        };
      default:
        // Log unknown Prisma error codes with full details
        logger.error('Unhandled Prisma error', {
          code: prismaError.code,
          name: prismaError.name,
          message: prismaError.message,
          meta: prismaError.meta,
        });
        return {
          statusCode: 400,
          code: 'DATABASE_ERROR',
          message: 'Database operation failed',
        };
    }
  }

  // Prisma connection errors
  if (errorName === 'PrismaClientInitializationError') {
    logger.error('Database connection failed', { error: errorMessage });
    return {
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Unable to connect to database',
    };
  }

  // Check if it's any other Prisma error (starts with PrismaClient)
  if (errorName.startsWith('PrismaClient')) {
    logger.error('Unhandled Prisma error', {
      name: errorName,
      message: errorMessage,
      stack: error.stack,
    });
    return {
      statusCode: 500,
      code: 'DATABASE_ERROR',
      message: 'A database error occurred',
    };
  }

  return null;
};

export const createErrorResponse = (error: Error | AppError): APIGatewayProxyResult => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    if (error instanceof ValidationError && error.field) {
      const response: ApiResponse = {
        success: false,
        error: { code, message, field: error.field },
      };
      return {
        statusCode,
        headers: { ...CORS_HEADERS, ...getCacheHeaders(0) },
        body: JSON.stringify(response),
      };
    }
  } else {
    // Check for Prisma errors first
    const prismaError = formatPrismaError(error);
    if (prismaError) {
      statusCode = prismaError.statusCode;
      code = prismaError.code;
      message = prismaError.message;
      // Log Prisma errors with sanitized information (avoid logging minified messages)
      const prismaErrorObj = error as Error & {
        code?: string;
        meta?: {
          modelName?: string;
          target?: string[];
        };
      };

      // Safely extract meta information
      let metaInfo: { modelName?: string; target?: string[] } | undefined;
      if (prismaErrorObj.meta) {
        metaInfo = {
          modelName: prismaErrorObj.meta.modelName,
          target: prismaErrorObj.meta.target ? [...prismaErrorObj.meta.target] : undefined,
        };
      }

      logger.warn('Prisma error', {
        code: prismaError.code,
        message: prismaError.message,
        prismaCode: prismaErrorObj.code,
        meta: metaInfo,
        errorName: error.name,
      });
    } else {
      // Only log unexpected errors with sanitized details (avoid logging huge minified messages)
      const errorSummary = {
        name: error.name,
        message: error.message?.substring(0, 500) || 'No message', // Limit message length
        stack: error.stack?.split('\n').slice(0, 5).join('\n') || undefined, // Limit stack trace
      };
      logger.error('Unhandled error', errorSummary);
    }
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      ...getCacheHeaders(0),
    },
    body: JSON.stringify(response),
  };
};

// Pre-computed OPTIONS response for CORS preflight
const OPTIONS_RESPONSE: APIGatewayProxyResult = {
  statusCode: 204,
  headers: CORS_HEADERS,
  body: '',
};

export const handleOptions = (): APIGatewayProxyResult => OPTIONS_RESPONSE;
