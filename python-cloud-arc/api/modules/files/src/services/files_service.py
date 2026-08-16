from __future__ import annotations

from typing import Protocol

from core.di import injectable
from utils.s3 import generate_presigned_download_url, generate_presigned_upload_url, generate_s3_key


class IFilesService(Protocol):
    def presign_upload(self, file_name: str, content_type: str) -> dict: ...
    def presign_download(self, s3_key: str) -> dict: ...


@injectable
class FilesService:
    def presign_upload(self, file_name: str, content_type: str) -> dict:
        key = generate_s3_key("uploads", file_name)
        return generate_presigned_upload_url(key, content_type)

    def presign_download(self, s3_key: str) -> dict:
        return generate_presigned_download_url(s3_key)
