import { injectable } from "inversify";
import {
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
} from "@forgearc/shared";

export interface IFilesService {
  presignUpload(
    fileName: string,
    contentType: string,
    fileSize?: number,
  ): Promise<unknown>;
  presignDownload(s3Key: string): Promise<unknown>;
}

@injectable()
export class FilesService implements IFilesService {
  presignUpload(fileName: string, contentType: string, fileSize = 1) {
    return generatePresignedUploadUrl({
      originalFileName: fileName,
      mimeType: contentType,
      fileSize,
    });
  }

  presignDownload(s3Key: string) {
    return generatePresignedDownloadUrl(s3Key);
  }
}
