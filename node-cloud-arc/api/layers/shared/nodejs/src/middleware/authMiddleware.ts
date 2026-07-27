import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyAccessToken, JWTPayload } from '../utils/webtoken';
import { createErrorResponse, AppError } from './errorHandler';

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  user?: JWTPayload;
}

export const authMiddleware = async (
  event: APIGatewayProxyEvent
): Promise<AuthenticatedEvent | APIGatewayProxyResult> => {
  try {
    const authHeader =
      event.headers?.Authorization ||
      event.headers?.authorization ||
      event.headers?.['Authorization'] ||
      event.headers?.['authorization'];

    if (!authHeader) {
      return createErrorResponse(
        new AppError('Authorization header is missing', 401, 'UNAUTHORIZED')
      );
    }
    if (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer ')) {
      return createErrorResponse(
        new AppError('Authorization header must start with "Bearer "', 401, 'UNAUTHORIZED')
      );
    }

    const token = authHeader.substring(authHeader.indexOf(' ') + 1).trim();

    if (!token) {
      return createErrorResponse(new AppError('Token is missing', 401, 'UNAUTHORIZED'));
    }

    const decoded = await verifyAccessToken(token);

    const authenticatedEvent: AuthenticatedEvent = {
      ...event,
      user: decoded,
    };

    return authenticatedEvent;
  } catch (error) {
    // Handle specific JWT errors
    let errorMessage = 'Invalid or expired token';
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        errorMessage = 'Access token has expired';
      } else if (error.message.includes('Invalid')) {
        errorMessage = 'Invalid access token';
      } else {
        errorMessage = error.message;
      }
    }

    return createErrorResponse(new AppError(errorMessage, 401, 'UNAUTHORIZED'));
  }
};
export const getAuthenticatedUser = (event: AuthenticatedEvent): JWTPayload => {
  if (!event.user) {
    throw new Error('User not authenticated');
  }
  return event.user;
};
