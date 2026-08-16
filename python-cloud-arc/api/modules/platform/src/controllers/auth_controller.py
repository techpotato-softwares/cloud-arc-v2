from __future__ import annotations

from decorators import Controller, Post
from decorators.auth_decorators import ApiPublic
from core.di import Inject, injectable
from core.openapi import ApiBody
from middleware.error_handler import create_success_response
from modules.platform.src.schemas.auth import LoginRequest, RefreshRequest
from modules.platform.src.services.auth_service import IAuthService
from modules.platform.src.types.svc_types import TYPES


@Controller(path="/api", lambda_name="auth")
@injectable
class AuthController:
    def __init__(self, auth_service: IAuthService = Inject(TYPES.AuthService)):
        self.auth_service = auth_service

    @Post("/login")
    @ApiPublic()
    @ApiBody(LoginRequest)
    def login(self, data: dict):
        result = self.auth_service.login(data or {})
        return create_success_response(result)

    @Post("/auth/refresh")
    @ApiPublic()
    @ApiBody(RefreshRequest)
    def refresh(self, data: dict):
        result = self.auth_service.refresh(data or {})
        return create_success_response(result)
