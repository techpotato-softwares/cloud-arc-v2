import { logger } from '@forgearc/shared';

/** Scheduled cleanup placeholder — prefer S3 lifecycle rules on the files bucket. */
export const handler = async (): Promise<{ ok: boolean }> => {
  logger.info('fileCleanup: no-op (configure S3 lifecycle on uploads/)');
  return { ok: true };
};
