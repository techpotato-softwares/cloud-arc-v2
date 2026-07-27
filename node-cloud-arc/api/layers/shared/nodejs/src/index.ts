// Config exports
export * from './config';

// Database exports
export {
  getPrismaClient,
  closeConnection,
  isConnectionHealthy,
  PrismaClient,
  Prisma,
} from './database';
// Prisma model types (PurchaseOrder, POItem, etc.) are automatically exported
// via 'export * from @prisma/client' in database/index.ts

// Utility exports
export * from './utils/logger';
export { getDatabaseConfig, getDatabaseUrl, clearSecretsCache } from './utils/secrets';
export type { DatabaseConfig } from './utils/secrets';

// S3 utilities exports
export {
  getS3Config,
  getS3Client,
  generateStoredFileName,
  generateS3Key,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  deleteFileFromS3,
  deleteFilesFromS3,
  checkFileExistsInS3,
  clearS3ClientCache,
  getAllowedMimeTypes,
  isAllowedMimeType,
  getMaxFileSize,
  isValidFileSize,
} from './utils/s3';
export type {
  S3Config,
  PresignedUploadUrl,
  PresignedDownloadUrl,
  FileUploadRequest,
} from './utils/s3';

// Middleware exports
export * from './middleware/errorHandler';
export { authMiddleware, getAuthenticatedUser } from './middleware/authMiddleware';
export type { AuthenticatedEvent } from './middleware/authMiddleware';

// Decorator exports
export * from './decorators';

// Core router exports
export * from './core';

// Web token exports
export {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateTokens,
  initializeJwtSecrets,
} from './utils/webtoken';
export type { JWTPayload, TokenResult } from './utils/webtoken';

// JWT secrets exports
export { getJwtSecrets, clearJwtSecretsCache, isJwtSecretsCached } from './utils/jwt-secrets';
export type { JwtSecrets } from './utils/jwt-secrets';
