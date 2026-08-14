from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


class PaginationMeta(BaseModel):
    page: int | None = None
    limit: int | None = None
    total: int | None = None
    totalPages: int | None = None


class ApiError(BaseModel):
    code: str
    message: str
    field: str | None = None


class ApiEnvelope(BaseModel):
    success: bool
    data: Any | None = None
    error: ApiError | None = None
    meta: PaginationMeta | None = Field(default=None)
