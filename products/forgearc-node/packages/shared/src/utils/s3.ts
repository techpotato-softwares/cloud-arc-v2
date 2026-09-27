import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAppConfig } from '../config';
import { logger } from './logger';

/**
 * S3 Configuration interface
 */
export interface S3Config {
  bucketName: string;
  region: string;
  uploadUrlExpiresIn: number; // seconds
  downloadUrlExpiresIn: number; // seconds
}

/**
 * Presigned URL response for uploads
 */
export interface PresignedUploadUrl {
  uploadUrl: string;
  s3Key: string;
  s3Bucket: string;
  expiresIn: number;
}

/**
 * Presigned URL response for downloads
 */
export interface PresignedDownloadUrl {
  downloadUrl: string;
  expiresIn: number;
}

/**
 * File metadata for upload request
 */
export interface FileUploadRequest {
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  poId?: string;
  entityType?: string;
  entityId?: string;
}

// Cache S3 client at module level for Lambda container reuse
let s3Client: S3Client | null = null;
let cachedS3Config: S3Config | null = null;

/**
 * Get S3 configuration from environment variables
 */
export const getS3Config = (): S3Config => {
  if (cachedS3Config) {
    return cachedS3Config;
  }

  const appConfig = getAppConfig();

  cachedS3Config = {
    bucketName: process.env.S3_BUCKET_NAME || `forgearc-files-${appConfig.environment}`,
    region: appConfig.region,
    uploadUrlExpiresIn: parseInt(process.env.S3_UPLOAD_URL_EXPIRES_IN || '3600', 10), // 1 hour default
    downloadUrlExpiresIn: parseInt(process.env.S3_DOWNLOAD_URL_EXPIRES_IN || '3600', 10), // 1 hour default
  };

  logger.debug('S3 configuration loaded', {
    bucketName: cachedS3Config.bucketName,
    region: cachedS3Config.region,
    uploadUrlExpiresIn: cachedS3Config.uploadUrlExpiresIn,
    downloadUrlExpiresIn: cachedS3Config.downloadUrlExpiresIn,
  });

  return cachedS3Config;
};

/**
 * Get or create S3 client with caching for Lambda container reuse
 */
export const getS3Client = (): S3Client => {
  if (!s3Client) {
    const config = getS3Config();
    s3Client = new S3Client({
      region: config.region,
      maxAttempts: 3,
      // Disable request checksum calculation - not needed for presigned URLs
      // and causes issues with browser uploads
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    logger.debug('S3 client initialized', { region: config.region });
  }
  return s3Client;
};

/**
 * Generate a unique file name with UUID prefix to avoid collisions
 */
export const generateStoredFileName = (originalFileName: string): string => {
  const uuid = crypto.randomUUID();
  // Sanitize the original file name to remove special characters
  const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  return `${uuid}_${sanitizedName}`;
};

/**
 * Generate S3 key (path) for a file upload
 * Format: uploads/{poId}/{entityType}/{entityId}/{storedFileName}
 * or: uploads/unassigned/{storedFileName} if no entity info provided
 */
export const generateS3Key = (
  storedFileName: string,
  poId?: string,
  entityType?: string,
  entityId?: string
): string => {
  if (poId && entityType && entityId) {
    return `uploads/${poId}/${entityType}/${entityId}/${storedFileName}`;
  }
  if (poId) {
    return `uploads/${poId}/general/${storedFileName}`;
  }
  return `uploads/unassigned/${storedFileName}`;
};

/**
 * Generate a presigned URL for uploading a file to S3
 */
export const generatePresignedUploadUrl = async (
  request: FileUploadRequest
): Promise<PresignedUploadUrl> => {
  const config = getS3Config();
  const client = getS3Client();

  const storedFileName = generateStoredFileName(request.originalFileName);
  const s3Key = generateS3Key(storedFileName, request.poId, request.entityType, request.entityId);

  logger.debug('Generating presigned upload URL', {
    originalFileName: request.originalFileName,
    s3Key,
    mimeType: request.mimeType,
    fileSize: request.fileSize,
  });

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: s3Key,
    ContentType: request.mimeType,
    Metadata: {
      'original-file-name': request.originalFileName,
      'entity-type': request.entityType || '',
      'entity-id': request.entityId || '',
      'po-id': request.poId || '',
    },
  });

  // Generate presigned URL
  // Note: unhoistableHeaders helps prevent checksum mismatch errors when uploading from browser
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: config.uploadUrlExpiresIn,
    unhoistableHeaders: new Set(['x-amz-checksum-crc32']),
  });

  logger.info('Presigned upload URL generated', {
    s3Key,
    expiresIn: config.uploadUrlExpiresIn,
  });

  return {
    uploadUrl,
    s3Key,
    s3Bucket: config.bucketName,
    expiresIn: config.uploadUrlExpiresIn,
  };
};

/**
 * Generate a presigned URL for downloading a file from S3
 */
export const generatePresignedDownloadUrl = async (
  s3Key: string,
  originalFileName?: string
): Promise<PresignedDownloadUrl> => {
  const config = getS3Config();
  const client = getS3Client();

  logger.debug('Generating presigned download URL', { s3Key });

  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: s3Key,
    // Set content disposition to attachment for download with original filename
    ResponseContentDisposition: originalFileName
      ? `attachment; filename="${originalFileName}"`
      : undefined,
  });

  const downloadUrl = await getSignedUrl(client, command, {
    expiresIn: config.downloadUrlExpiresIn,
  });

  logger.info('Presigned download URL generated', {
    s3Key,
    expiresIn: config.downloadUrlExpiresIn,
  });

  return {
    downloadUrl,
    expiresIn: config.downloadUrlExpiresIn,
  };
};

/**
 * Delete a single file from S3
 */
export const deleteFileFromS3 = async (s3Key: string): Promise<void> => {
  const config = getS3Config();
  const client = getS3Client();

  logger.debug('Deleting file from S3', { s3Key, bucket: config.bucketName });

  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: s3Key,
  });

  await client.send(command);

  logger.info('File deleted from S3', { s3Key });
};

/**
 * Delete multiple files from S3 in a batch
 * S3 supports up to 1000 objects per delete request
 */
export const deleteFilesFromS3 = async (s3Keys: string[]): Promise<void> => {
  if (s3Keys.length === 0) {
    return;
  }

  const config = getS3Config();
  const client = getS3Client();

  logger.debug('Deleting files from S3 in batch', {
    count: s3Keys.length,
    bucket: config.bucketName,
  });

  // S3 DeleteObjects supports max 1000 objects per request
  const batchSize = 1000;
  for (let i = 0; i < s3Keys.length; i += batchSize) {
    const batch = s3Keys.slice(i, i + batchSize);

    const command = new DeleteObjectsCommand({
      Bucket: config.bucketName,
      Delete: {
        Objects: batch.map((key) => ({ Key: key })),
        Quiet: true, // Don't return deleted object info
      },
    });

    await client.send(command);

    logger.debug('Batch delete completed', {
      batchStart: i,
      batchEnd: i + batch.length,
    });
  }

  logger.info('Files deleted from S3', { count: s3Keys.length });
};

/**
 * Check if a file exists in S3
 */
export const checkFileExistsInS3 = async (s3Key: string): Promise<boolean> => {
  const config = getS3Config();
  const client = getS3Client();

  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: s3Key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    const err = error as { name?: string };
    if (err.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * Clear S3 client cache - useful for testing or forced refresh
 */
export const clearS3ClientCache = (): void => {
  s3Client = null;
  cachedS3Config = null;
};

/**
 * Get allowed MIME types for file uploads
 */
export const getAllowedMimeTypes = (): string[] => {
  return [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
};

/**
 * Validate if a MIME type is allowed
 */
export const isAllowedMimeType = (mimeType: string): boolean => {
  return getAllowedMimeTypes().includes(mimeType);
};

/**
 * Get maximum allowed file size in bytes (default 10MB)
 */
export const getMaxFileSize = (): number => {
  return parseInt(process.env.S3_MAX_FILE_SIZE || '10485760', 10); // 10MB
};

/**
 * Validate file size against maximum allowed
 */
export const isValidFileSize = (fileSize: number): boolean => {
  return fileSize > 0 && fileSize <= getMaxFileSize();
};
