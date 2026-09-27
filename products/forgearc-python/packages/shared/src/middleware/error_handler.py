from __future__ import annotations

import json
from typing import Any

from core.request_context import response_headers


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500, code: str = "INTERNAL_ERROR"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, 404, "NOT_FOUND")


class ValidationError(AppError):
    def __init__(self, message: str = "Validation failed", field: str | None = None):
        super().__init__(message, 400, "VALIDATION_ERROR")
        self.field = field


class ConflictError(AppError):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message, 409, "CONFLICT")


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, 403, "FORBIDDEN")


def create_success_response(data: Any, status_code: int = 200, meta: dict | None = None) -> dict:
    body: dict[str, Any] = {"success": True, "data": data}
    if meta:
        body["meta"] = meta
    return {"statusCode": status_code, "headers": response_headers(), "body": json.dumps(body, default=str)}


def create_error_response(error: Exception) -> dict:
    if isinstance(error, AppError):
        status, code, message = error.status_code, error.code, error.message
        err: dict[str, Any] = {"code": code, "message": message}
        if isinstance(error, ValidationError) and error.field:
            err["field"] = error.field
    else:
        status, code, message = 500, "INTERNAL_ERROR", str(error) or "Internal server error"
        err = {"code": code, "message": message}
    body = {"success": False, "error": err}
    return {"statusCode": status, "headers": response_headers(), "body": json.dumps(body)}


def handle_options() -> dict:
    return {"statusCode": 204, "headers": response_headers(), "body": ""}
