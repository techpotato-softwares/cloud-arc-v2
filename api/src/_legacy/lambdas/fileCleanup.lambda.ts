/**
 * File Cleanup Lambda
 *
 * Scheduled job to cleanup orphaned pending files that were never confirmed.
 * This runs periodically (e.g., every 6 hours via CloudWatch Events) to:
 * 1. Find pending files older than 24 hours
 * 2. Delete them from S3
 * 3. Delete their database records
 *
 * This prevents S3 storage costs from abandoned upload attempts.
 */

import 'reflect-metadata';
import { ScheduledEvent, Context, ScheduledHandler } from 'aws-lambda';
import { Container } from 'inversify';
import { getPrismaClient, deleteFilesFromS3, logger } from '@arcforge/shared';
import { TYPES } from '../types/types';
import { FileRepository, IFileRepository } from '../repositories/FileRepository';

// Configuration
const CLEANUP_OLDER_THAN_HOURS = parseInt(process.env.FILE_CLEANUP_HOURS || '24', 10);
const DRY_RUN = process.env.FILE_CLEANUP_DRY_RUN === 'true';

/**
 * Lambda handler for file cleanup
 */
export const handler: ScheduledHandler = async (
  event: ScheduledEvent,
  context: Context
): Promise<void> => {
  const requestId = context.awsRequestId;
  const startTime = Date.now();

  logger.info('File cleanup job started', {
    requestId,
    olderThanHours: CLEANUP_OLDER_THAN_HOURS,
    dryRun: DRY_RUN,
  });

  try {
    // Initialize DI container
    const container = new Container();

    // Bind PrismaClient
    const prismaClient = await getPrismaClient();
    container.bind(TYPES.PrismaClient).toConstantValue(prismaClient);

    // Bind FileRepository
    container.bind<IFileRepository>(TYPES.FileRepository).to(FileRepository);

    // Get repository instance
    const fileRepository = container.get<IFileRepository>(TYPES.FileRepository);

    // Find orphaned pending files
    const orphanedFiles = await fileRepository.findOrphanedPendingFiles(CLEANUP_OLDER_THAN_HOURS);

    logger.info('Found orphaned pending files', {
      count: orphanedFiles.length,
      requestId,
    });

    if (orphanedFiles.length === 0) {
      logger.info('No orphaned files to cleanup', { requestId });
      return;
    }

    // Log files to be deleted
    const filesToDelete = orphanedFiles.map((f) => ({
      fileId: f.fileId,
      originalFileName: f.originalFileName,
      s3Key: f.s3Key,
      createdAt: f.createdAt.toISOString(),
    }));

    logger.info('Files to be cleaned up', {
      files: filesToDelete,
      dryRun: DRY_RUN,
      requestId,
    });

    if (DRY_RUN) {
      logger.info('Dry run mode - no files deleted', {
        wouldDelete: orphanedFiles.length,
        requestId,
      });
      return;
    }

    // Delete from S3
    const s3Keys = orphanedFiles.map((f) => f.s3Key);
    await deleteFilesFromS3(s3Keys);

    logger.info('Deleted files from S3', {
      count: s3Keys.length,
      requestId,
    });

    // Delete from database
    const fileIds = orphanedFiles.map((f) => f.fileId);
    const deletedCount = await fileRepository.hardDeleteMany(fileIds);

    logger.info('Deleted file records from database', {
      count: deletedCount,
      requestId,
    });

    const duration = Date.now() - startTime;
    logger.info('File cleanup job completed', {
      deletedFiles: deletedCount,
      duration: `${duration}ms`,
      requestId,
    });
  } catch (error) {
    const err = error as Error;
    logger.error('File cleanup job failed', {
      error: err.message,
      stack: err.stack,
      requestId,
    });
    throw error;
  }
};

/**
 * Manual trigger handler for testing/admin use
 * Can be invoked directly with custom parameters
 */
export interface ManualCleanupEvent {
  olderThanHours?: number;
  dryRun?: boolean;
}

export const manualHandler = async (
  event: ManualCleanupEvent,
  context: Context
): Promise<{
  deletedCount: number;
  deletedFiles: { fileId: number; originalFileName: string; s3Key: string }[];
  dryRun: boolean;
}> => {
  const requestId = context.awsRequestId;
  const olderThanHours = event.olderThanHours || CLEANUP_OLDER_THAN_HOURS;
  const dryRun = event.dryRun ?? DRY_RUN;

  logger.info('Manual file cleanup started', {
    requestId,
    olderThanHours,
    dryRun,
  });

  try {
    // Initialize DI container
    const container = new Container();

    // Bind PrismaClient
    const prismaClient = await getPrismaClient();
    container.bind(TYPES.PrismaClient).toConstantValue(prismaClient);

    // Bind FileRepository
    container.bind<IFileRepository>(TYPES.FileRepository).to(FileRepository);

    // Get repository instance
    const fileRepository = container.get<IFileRepository>(TYPES.FileRepository);

    // Find orphaned pending files
    const orphanedFiles = await fileRepository.findOrphanedPendingFiles(olderThanHours);

    const deletedFilesInfo = orphanedFiles.map((f) => ({
      fileId: f.fileId,
      originalFileName: f.originalFileName,
      s3Key: f.s3Key,
    }));

    if (orphanedFiles.length === 0 || dryRun) {
      return {
        deletedCount: orphanedFiles.length,
        deletedFiles: deletedFilesInfo,
        dryRun,
      };
    }

    // Delete from S3
    const s3Keys = orphanedFiles.map((f) => f.s3Key);
    await deleteFilesFromS3(s3Keys);

    // Delete from database
    const fileIds = orphanedFiles.map((f) => f.fileId);
    await fileRepository.hardDeleteMany(fileIds);

    return {
      deletedCount: orphanedFiles.length,
      deletedFiles: deletedFilesInfo,
      dryRun: false,
    };
  } catch (error) {
    logger.error('Manual file cleanup failed', error);
    throw error;
  }
};
