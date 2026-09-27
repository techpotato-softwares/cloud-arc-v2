from pydantic import BaseModel


class PresignUploadRequest(BaseModel):
    fileName: str
    contentType: str = "application/octet-stream"


class PresignDownloadRequest(BaseModel):
    s3Key: str
