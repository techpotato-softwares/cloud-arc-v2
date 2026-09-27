from __future__ import annotations

from typing import Any, Protocol

from core.di import Inject, injectable
from middleware.error_handler import AppError, ValidationError
from utils.webtoken import generate_tokens, verify_refresh_token

from modules.platform.src.repositories.auth_repository import IAuthRepository
from modules.platform.src.types.svc_types import TYPES


class IAuthService(Protocol):
    def login(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def refresh(self, data: dict[str, Any]) -> dict[str, Any]: ...


@injectable
class AuthService:
    def __init__(self, auth_repository: IAuthRepository = Inject(TYPES.AuthRepository)):
        self.auth_repository = auth_repository

    def login(self, data: dict[str, Any]) -> dict[str, Any]:
        username = (data or {}).get("username")
        password = (data or {}).get("password")
        if not username or not password:
            raise ValidationError("Username and password are required")

        record = self.auth_repository.find_by_username_or_email(username)
        if not record or not self.auth_repository.validate_password(record.user, password):
            raise AppError("Invalid username or password", 401, "UNAUTHORIZED")

        user = record.user
        payload = {
            "userId": user.user_id,
            "username": user.username,
            "email": user.email,
            "role": record.role_name,
            "tenantId": record.tenant_id,
            "permissions": record.permissions,
            "modulesEnabled": record.modules_enabled,
        }
        tokens = generate_tokens(payload)
        if not tokens.get("accessToken") or not tokens.get("refreshToken"):
            raise AppError("Failed to generate authentication tokens", 500, "TOKEN_GENERATION_ERROR")

        return {
            "success": True,
            "message": "Login successful",
            **tokens,
            "user": {
                "userId": user.user_id,
                "username": user.username,
                "email": user.email,
                "roleName": record.role_name,
                "roleId": record.role_id,
                "permissions": record.permissions,
            },
        }

    def refresh(self, data: dict[str, Any]) -> dict[str, Any]:
        token = (data or {}).get("refreshToken")
        if not token:
            raise ValidationError("Refresh token is required")
        decoded = verify_refresh_token(token)
        clean = {
            k: decoded[k]
            for k in ("userId", "username", "email", "role", "tenantId", "permissions", "modulesEnabled")
            if k in decoded
        }
        tokens = generate_tokens(clean)
        if not tokens.get("accessToken") or not tokens.get("refreshToken"):
            raise AppError("Failed to generate new tokens", 500, "TOKEN_GENERATION_ERROR")
        return {"success": True, "message": "Token refreshed successfully", **tokens}
