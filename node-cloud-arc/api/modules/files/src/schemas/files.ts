import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const PresignUploadSchema = z
  .object({
    fileName: z.string(),
    contentType: z.string().optional(),
  })
  .openapi('PresignUploadRequest');

export const PresignDownloadSchema = z
  .object({
    s3Key: z.string(),
  })
  .openapi('PresignDownloadRequest');

export type PresignUploadRequest = z.infer<typeof PresignUploadSchema>;
export type PresignDownloadRequest = z.infer<typeof PresignDownloadSchema>;
