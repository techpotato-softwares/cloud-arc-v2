/**
 * Response for a single file upload record
 */
export interface FileUploadResponse {
  fileId: number;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  status: 'pending' | 'confirmed' | 'deleted';
  entityType?: string;
  entityId?: string;
  poId?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response for presigned upload URL generation
 */
export interface PresignedUploadUrlResponse {
  fileId: number;
  originalFileName: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number; // seconds
}

/**
 * Response for batch presigned URL generation
 */
export interface GeneratePresignedUrlsResponse {
  files: PresignedUploadUrlResponse[];
}

/**
 * Response for presigned download URL
 */
export interface PresignedDownloadUrlResponse {
  fileId: number;
  originalFileName: string;
  downloadUrl: string;
  expiresIn: number; // seconds
}

/**
 * Response for file list
 */
export interface FileListResponse {
  data: FileUploadResponse[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Response for file confirmation
 */
export interface ConfirmFilesResponse {
  confirmedCount: number;
  files: FileUploadResponse[];
}

/**
 * Response for file deletion
 */
export interface DeleteFileResponse {
  fileId: number;
  deleted: boolean;
}

/**
 * Response for cleanup operation
 */
export interface CleanupOrphanedFilesResponse {
  deletedCount: number;
  deletedFiles: {
    fileId: number;
    originalFileName: string;
    s3Key: string;
  }[];
  dryRun: boolean;
}
