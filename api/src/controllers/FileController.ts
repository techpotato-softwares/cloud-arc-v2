import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  CurrentUser,
  createSuccessResponse,
  ValidationError,
  JWTPayload,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IFileService } from '../services/FileService';
import {
  GeneratePresignedUrlsRequest,
  ConfirmFilesRequest,
  CleanupOrphanedFilesRequest,
} from '../schemas/request/FileRequest';

export interface IFileController {
  generatePresignedUrls(
    data: GeneratePresignedUrlsRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  confirmFiles(data: ConfirmFilesRequest, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  getDownloadUrl(fileId: string): Promise<APIGatewayProxyResult>;
  getEntityFiles(
    entityType: string,
    entityId: string,
    page?: string,
    limit?: string
  ): Promise<APIGatewayProxyResult>;
  getPOFiles(poId: string, page?: string, limit?: string): Promise<APIGatewayProxyResult>;
  deleteFile(fileId: string, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  cleanupOrphanedFiles(data: CleanupOrphanedFilesRequest): Promise<APIGatewayProxyResult>;
  getFileById(fileId: string): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api/files', lambdaName: 'file' })
@injectable()
export class FileController implements IFileController {
  constructor(@inject(TYPES.FileService) private fileService: IFileService) {}

  /**
   * Generate presigned upload URLs for multiple files
   * POST /api/files/presigned-urls
   */
  @Post('/presigned-urls')
  async generatePresignedUrls(
    @Body() data: GeneratePresignedUrlsRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    // Validate request
    if (!data.files || data.files.length === 0) {
      throw new ValidationError('At least one file is required');
    }

    // Validate each file has required fields
    for (const file of data.files) {
      if (!file.originalFileName) {
        throw new ValidationError('File originalFileName is required');
      }
      if (!file.mimeType) {
        throw new ValidationError('File mimeType is required');
      }
      if (!file.fileSize || file.fileSize <= 0) {
        throw new ValidationError('File fileSize must be a positive number');
      }
    }

    const enrichedData = {
      ...data,
      createdById: currentUser.userId,
      updatedById: currentUser.userId,
    };
    const result = await this.fileService.generatePresignedUploadUrls(enrichedData);
    return createSuccessResponse(result, 201);
  }

  /**
   * Confirm uploaded files and link to entity
   * POST /api/files/confirm
   */
  @Post('/confirm')
  async confirmFiles(
    @Body() data: ConfirmFilesRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    // Validate request
    if (!data.fileIds || data.fileIds.length === 0) {
      throw new ValidationError('At least one fileId is required');
    }
    if (!data.entityType) {
      throw new ValidationError('entityType is required');
    }
    if (!data.entityId) {
      throw new ValidationError('entityId is required');
    }

    const enrichedData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const result = await this.fileService.confirmFiles(enrichedData);
    return createSuccessResponse(result);
  }

  /**
   * Get presigned download URL for a file
   * GET /api/files/:fileId/download-url
   */
  @Get('/{fileId}/download-url')
  async getDownloadUrl(@Param('fileId') fileId: string): Promise<APIGatewayProxyResult> {
    const id = parseInt(fileId, 10);
    if (isNaN(id)) {
      throw new ValidationError('Invalid file ID');
    }

    const result = await this.fileService.getDownloadUrl(id);
    return createSuccessResponse(result);
  }

  /**
   * Get files for a specific entity
   * GET /api/files/entity/:entityType/:entityId
   */
  @Get('/entity/{entityType}/{entityId}')
  async getEntityFiles(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string
  ): Promise<APIGatewayProxyResult> {
    if (!entityType) {
      throw new ValidationError('entityType is required');
    }
    if (!entityId) {
      throw new ValidationError('entityId is required');
    }

    const result = await this.fileService.getEntityFiles({
      entityType,
      entityId,
      status: status as 'pending' | 'confirmed' | 'deleted' | undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return createSuccessResponse(result);
  }

  /**
   * Get all files for a PO
   * GET /api/files/po/:poId
   */
  @Get('/po/{poId}')
  async getPOFiles(
    @Param('poId') poId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<APIGatewayProxyResult> {
    if (!poId) {
      throw new ValidationError('poId is required');
    }

    const result = await this.fileService.getPOFiles(
      poId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
    return createSuccessResponse(result);
  }

  /**
   * Get a single file by ID
   * GET /api/files/:fileId
   */
  @Get('/{fileId}')
  async getFileById(@Param('fileId') fileId: string): Promise<APIGatewayProxyResult> {
    const id = parseInt(fileId, 10);
    if (isNaN(id)) {
      throw new ValidationError('Invalid file ID');
    }

    const file = await this.fileService.getFileById(id);
    if (!file) {
      throw new ValidationError('File not found');
    }

    return createSuccessResponse(file);
  }

  /**
   * Soft delete a file
   * DELETE /api/files/:fileId
   */
  @Delete('/{fileId}')
  async deleteFile(
    @Param('fileId') fileId: string,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const id = parseInt(fileId, 10);
    if (isNaN(id)) {
      throw new ValidationError('Invalid file ID');
    }

    const result = await this.fileService.deleteFile(id, currentUser.userId);
    return createSuccessResponse(result);
  }

  /**
   * Cleanup orphaned pending files (admin only)
   * POST /api/files/cleanup
   */
  @Post('/cleanup')
  async cleanupOrphanedFiles(
    @Body() data: CleanupOrphanedFilesRequest
  ): Promise<APIGatewayProxyResult> {
    const result = await this.fileService.cleanupOrphanedFiles({
      olderThanHours: data.olderThanHours || 24,
      dryRun: data.dryRun || false,
    });
    return createSuccessResponse(result);
  }
}
