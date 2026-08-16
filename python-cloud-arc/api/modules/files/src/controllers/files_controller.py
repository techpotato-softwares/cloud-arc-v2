from __future__ import annotations

from decorators import Controller, Post
from decorators.auth_decorators import RequireModule, RequirePermission
from core.di import Inject, injectable
from core.openapi import ApiBody
from middleware.error_handler import create_success_response
from modules.files.src.schemas.files import PresignDownloadRequest, PresignUploadRequest
from modules.files.src.services.files_service import IFilesService
from modules.files.src.types.svc_types import TYPES


@Controller(path="/api/files", lambda_name="files")
@injectable
class FilesController:
    def __init__(self, service: IFilesService = Inject(TYPES.FilesService)):
        self.service = service

    @Post("/presign")
    @RequireModule("files")
    @RequirePermission("files:write", "admin")
    @ApiBody(PresignUploadRequest)
    def presign(self, data: dict, user=None):
        return create_success_response(
            self.service.presign_upload(data.get("fileName") or "file", data.get("contentType") or "application/octet-stream")
        )

    @Post("/download")
    @RequireModule("files")
    @RequirePermission("files:read", "admin")
    @ApiBody(PresignDownloadRequest)
    def download(self, data: dict, user=None):
        return create_success_response(self.service.presign_download(data.get("s3Key") or ""))
