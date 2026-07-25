import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { FileUpload } from '@prisma/client';
import {
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  deleteFilesFromS3,
  isAllowedMimeType,
  isValidFileSize,
  getS3Config,
  generateStoredFileName,
} from '@arcforge/shared';
import { IFileRepository, FileStatus } from '../repositories/FileRepository';
import {
  GeneratePresignedUrlsRequest,
  ConfirmFilesRequest,
  ListEntityFilesRequest,
  CleanupOrphanedFilesRequest,
} from '../schemas/request/FileRequest';
import {
  FileUploadResponse,
  GeneratePresignedUrlsResponse,
  PresignedDownloadUrlResponse,
  FileListResponse,
  ConfirmFilesResponse,
  DeleteFileResponse,
  CleanupOrphanedFilesResponse,
} from '../schemas/response/FileResponse';

export interface IFileService {
  generatePresignedUploadUrls(
    request: GeneratePresignedUrlsRequest
  ): Promise<GeneratePresignedUrlsResponse>;
  confirmFiles(request: ConfirmFilesRequest): Promise<ConfirmFilesResponse>;
  getDownloadUrl(fileId: number): Promise<PresignedDownloadUrlResponse>;
  getEntityFiles(request: ListEntityFilesRequest): Promise<FileListResponse>;
  getPOFiles(poId: string, page?: number, limit?: number): Promise<FileListResponse>;
  deleteFile(fileId: number, updatedById?: number): Promise<DeleteFileResponse>;
  cleanupOrphanedFiles(request: CleanupOrphanedFilesRequest): Promise<CleanupOrphanedFilesResponse>;
  getFileById(fileId: number): Promise<FileUploadResponse | null>;
}

@injectable()
export class FileService implements IFileService {
  constructor(
    @inject(TYPES.FileRepository)
    private fileRepository: IFileRepository
  ) {}

  /**
   * Map FileUpload entity to response DTO
   */
  private mapToResponse(file: FileUpload): FileUploadResponse {
    return {
      fileId: file.fileId,
      originalFileName: file.originalFileName,
      storedFileName: file.storedFileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      s3Key: file.s3Key,
      status: file.status as 'pending' | 'confirmed' | 'deleted',
      entityType: file.entityType || undefined,
      entityId: file.entityId || undefined,
      poId: file.poId || undefined,
      confirmedAt: file.confirmedAt?.toISOString(),
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }

  /**
   * Generate presigned upload URLs for multiple files
   * Creates pending file records in database
   */
  async generatePresignedUploadUrls(
    request: GeneratePresignedUrlsRequest
  ): Promise<GeneratePresignedUrlsResponse> {
    const { files, poId, entityType, entityId } = request;
    const s3Config = getS3Config();

    // Validate all files first
    for (const file of files) {
      if (!isAllowedMimeType(file.mimeType)) {
        throw new Error(
          `Invalid file type: ${file.mimeType}. Allowed types: images, PDF, Word, Excel.`
        );
      }
      if (!isValidFileSize(file.fileSize)) {
        throw new Error(`File size exceeds maximum allowed size for: ${file.originalFileName}`);
      }
    }

    // Generate presigned URLs and create database records
    const results = await Promise.all(
      files.map(async (file) => {
        // Generate stored file name
        const storedFileName = generateStoredFileName(file.originalFileName);

        // Generate presigned upload URL (s3Key is generated inside this function)
        const presignedUrl = await generatePresignedUploadUrl({
          originalFileName: file.originalFileName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          poId,
          entityType,
          entityId,
        });

        // Create pending record in database
        const fileRecord = await this.fileRepository.create({
          originalFileName: file.originalFileName,
          storedFileName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          s3Key: presignedUrl.s3Key,
          s3Bucket: s3Config.bucketName,
          status: 'pending',
          entityType,
          entityId,
          poId,
        });

        return {
          fileId: fileRecord.fileId,
          originalFileName: file.originalFileName,
          uploadUrl: presignedUrl.uploadUrl,
          s3Key: presignedUrl.s3Key,
          expiresIn: presignedUrl.expiresIn,
        };
      })
    );

    return { files: results };
  }

  /**
   * Confirm uploaded files and link them to an entity
   */
  async confirmFiles(request: ConfirmFilesRequest): Promise<ConfirmFilesResponse> {
    const { fileIds, entityType, entityId, poId } = request;

    // Get all files to confirm
    const files = await this.fileRepository.findByIds(fileIds);

    if (files.length === 0) {
      throw new Error('No files found with the provided IDs');
    }

    // Verify all files are in pending status
    const nonPendingFiles = files.filter((f) => f.status !== 'pending');
    if (nonPendingFiles.length > 0) {
      throw new Error(
        `Files must be in pending status to confirm. Found non-pending files: ${nonPendingFiles.map((f) => f.fileId).join(', ')}`
      );
    }

    // Update all files to confirmed status
    await this.fileRepository.updateMany(fileIds, {
      status: 'confirmed',
      entityType,
      entityId,
      poId,
      confirmedAt: new Date(),
    });

    // Fetch updated files
    const confirmedFiles = await this.fileRepository.findByIds(fileIds);

    return {
      confirmedCount: confirmedFiles.length,
      files: confirmedFiles.map((f) => this.mapToResponse(f)),
    };
  }

  /**
   * Get a presigned download URL for a file
   */
  async getDownloadUrl(fileId: number): Promise<PresignedDownloadUrlResponse> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    if (file.status === 'deleted') {
      throw new Error(`File has been deleted: ${fileId}`);
    }

    const presignedUrl = await generatePresignedDownloadUrl(file.s3Key, file.originalFileName);

    return {
      fileId: file.fileId,
      originalFileName: file.originalFileName,
      downloadUrl: presignedUrl.downloadUrl,
      expiresIn: presignedUrl.expiresIn,
    };
  }

  /**
   * Get files for a specific entity
   */
  async getEntityFiles(request: ListEntityFilesRequest): Promise<FileListResponse> {
    const { entityType, entityId, status, page = 1, limit = 20 } = request;

    const files = await this.fileRepository.findByEntity(
      entityType,
      entityId,
      status as FileStatus | undefined
    );

    // Manual pagination for entity files (usually small number)
    const startIndex = (page - 1) * limit;
    const paginatedFiles = files.slice(startIndex, startIndex + limit);

    return {
      data: paginatedFiles.map((f) => this.mapToResponse(f)),
      pagination: {
        page,
        limit,
        total: files.length,
        totalPages: Math.ceil(files.length / limit),
      },
    };
  }

  /**
   * Get all files for a PO
   */
  async getPOFiles(poId: string, page = 1, limit = 20): Promise<FileListResponse> {
    const { rows, count } = await this.fileRepository.findByPO(poId, { page, limit });

    return {
      data: rows.map((f) => this.mapToResponse(f)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Soft delete a file
   */
  async deleteFile(fileId: number, updatedById?: number): Promise<DeleteFileResponse> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }

    await this.fileRepository.softDelete(fileId, updatedById);

    // Note: We don't delete from S3 on soft delete
    // The cleanup job will handle S3 deletion for old deleted files

    return {
      fileId,
      deleted: true,
    };
  }

  /**
   * Cleanup orphaned pending files
   */
  async cleanupOrphanedFiles(
    request: CleanupOrphanedFilesRequest
  ): Promise<CleanupOrphanedFilesResponse> {
    const { olderThanHours = 24, dryRun = false } = request;

    // Find orphaned pending files
    const orphanedFiles = await this.fileRepository.findOrphanedPendingFiles(olderThanHours);

    if (orphanedFiles.length === 0) {
      return {
        deletedCount: 0,
        deletedFiles: [],
        dryRun,
      };
    }

    const deletedFilesInfo = orphanedFiles.map((f) => ({
      fileId: f.fileId,
      originalFileName: f.originalFileName,
      s3Key: f.s3Key,
    }));

    if (dryRun) {
      return {
        deletedCount: orphanedFiles.length,
        deletedFiles: deletedFilesInfo,
        dryRun: true,
      };
    }

    // Delete from S3
    const s3Keys = orphanedFiles.map((f) => f.s3Key);
    await deleteFilesFromS3(s3Keys);

    // Delete from database
    const fileIds = orphanedFiles.map((f) => f.fileId);
    await this.fileRepository.hardDeleteMany(fileIds);

    return {
      deletedCount: orphanedFiles.length,
      deletedFiles: deletedFilesInfo,
      dryRun: false,
    };
  }

  /**
   * Get a single file by ID
   */
  async getFileById(fileId: number): Promise<FileUploadResponse | null> {
    const file = await this.fileRepository.findById(fileId);

    if (!file) {
      return null;
    }

    return this.mapToResponse(file);
  }
}
