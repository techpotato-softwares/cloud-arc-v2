import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const PaginationMetaSchema = z
  .object({
    page: z.number().int().optional(),
    limit: z.number().int().optional(),
    total: z.number().int().optional(),
    totalPages: z.number().int().optional(),
  })
  .openapi('PaginationMeta');

export const ApiErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    field: z.string().optional(),
  })
  .openapi('ApiError');

export const ApiEnvelopeSchema = z
  .object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: ApiErrorSchema.optional(),
    meta: PaginationMetaSchema.optional(),
  })
  .openapi('ApiEnvelope');
