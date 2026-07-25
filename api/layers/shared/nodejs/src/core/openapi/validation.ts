import type { ZodError, ZodTypeAny } from 'zod';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { RouteMetadata } from '../../decorators/metadata';
import { ValidationError } from '../../middleware/errorHandler';

function formatZodIssue(error: ZodError): { message: string; field?: string } {
  const issue = error.issues[0];
  const field = issue.path.length > 0 ? issue.path.join('.') : undefined;
  return { message: issue.message, field };
}

export function validateRouteInput(
  route: RouteMetadata,
  event: APIGatewayProxyEvent
): void {
  if (route.bodySchema) {
    let raw: unknown;
    try {
      if (!event.body) {
        raw = {};
      } else {
        const body = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf-8')
          : event.body;
        raw = JSON.parse(body);
      }
    } catch {
      throw new ValidationError('Invalid JSON body');
    }
    const result = route.bodySchema.safeParse(raw);
    if (!result.success) {
      const { message, field } = formatZodIssue(result.error);
      throw new ValidationError(message, field);
    }
  }

  if (route.querySchema) {
    const result = route.querySchema.safeParse(event.queryStringParameters ?? {});
    if (!result.success) {
      const { message, field } = formatZodIssue(result.error);
      throw new ValidationError(message, field);
    }
  }
}

export type { ZodTypeAny };
