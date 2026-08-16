import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Post,
  Body,
  ApiBody,
  RequireModule,
  RequirePermission,
  ApiTags,
  createSuccessResponse,
} from '@arcforge/shared';
import { TYPES } from '../types/svc.types';
import { IFilesService } from '../services/FilesService';
import {
  PresignDownloadRequest,
  PresignDownloadSchema,
  PresignUploadRequest,
  PresignUploadSchema,
} from '../schemas/files';

@Controller({ path: '/api/files', lambdaName: 'files' })
@injectable()
export class FilesController {
  constructor(@inject(TYPES.FilesService) private service: IFilesService) {}

  @Post('/presign')
  @RequireModule('files')
  @RequirePermission('files:write', 'admin')
  @ApiTags('Files')
  @ApiBody(PresignUploadSchema)
  async presign(@Body() data: PresignUploadRequest): Promise<APIGatewayProxyResult> {
    const result = await this.service.presignUpload(
      data.fileName,
      data.contentType || 'application/octet-stream'
    );
    return createSuccessResponse(result);
  }

  @Post('/download')
  @RequireModule('files')
  @RequirePermission('files:read', 'admin')
  @ApiTags('Files')
  @ApiBody(PresignDownloadSchema)
  async download(@Body() data: PresignDownloadRequest): Promise<APIGatewayProxyResult> {
    return createSuccessResponse(await this.service.presignDownload(data.s3Key));
  }
}
