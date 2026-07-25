import { BaseListRequest } from './BaseListRequest';

/**
 * Request to generate presigned upload URLs
 */
export interface GeneratePresignedUrlsRequest {
  files: FileUploadInfo[];
  poId?: string;
  entityType?: string; // dispatch, delivery, ppm, commissioning, warranty
  entityId?: string;
}

/**
 * Individual file info for presigned URL generation
 */
export interface FileUploadInfo {
  originalFileName: string;
  mimeType: string;
  fileSize: number; // Size in bytes
}

/**
 * Request to confirm uploaded files
 */
export interface ConfirmFilesRequest {
  fileIds: number[];
  entityType: string; // dispatch, delivery, ppm, commissioning, warranty
  entityId: string;
  poId?: string;
}

/**
 * Request to list files for an entity
 */
export interface ListEntityFilesRequest extends BaseListRequest {
  entityType: string;
  entityId: string;
  status?: 'pending' | 'confirmed' | 'deleted';
}

/**
 * Request to list files by PO
 */
export interface ListPOFilesRequest extends BaseListRequest {
  poId: string;
  entityType?: string;
  status?: 'pending' | 'confirmed' | 'deleted';
}

/**
 * Request for cleanup of orphaned files
 */
export interface CleanupOrphanedFilesRequest {
  olderThanHours?: number; // Default 24 hours
  dryRun?: boolean; // If true, don't actually delete, just return what would be deleted
}
