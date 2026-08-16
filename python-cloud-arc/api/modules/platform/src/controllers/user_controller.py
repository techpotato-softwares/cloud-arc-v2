from __future__ import annotations

from decorators import Controller, Get, Post, Put, Delete
from decorators.auth_decorators import RequirePermission
from core.di import Inject, injectable
from core.openapi import ApiBody
from core.pagination import parse_list_query
from middleware.error_handler import ValidationError, create_success_response
from modules.platform.src.schemas.auth import CreateUserRequest, UpdateUserRequest
from modules.platform.src.services.user_service import IUserService
from modules.platform.src.types.svc_types import TYPES


@Controller(path="/api/user", lambda_name="user")
@injectable
class UserController:
    def __init__(self, user_service: IUserService = Inject(TYPES.UserService)):
        self.user_service = user_service

    @Post("/")
    @RequirePermission("user:create", "user:write", "admin")
    @ApiBody(CreateUserRequest)
    def create(self, data: dict, user=None):
        payload = {**(data or {}), "tenantId": (user or {}).get("tenantId")}
        return create_success_response(self.user_service.create_user(payload), 201)

    @Get("/")
    @RequirePermission("user:read", "admin")
    def get_all(self, event=None):
        params = parse_list_query((event or {}).get("queryStringParameters"))
        return create_success_response(self.user_service.get_all_users(params))

    @Get("/{id}")
    @RequirePermission("user:read", "admin")
    def get_by_id(self, id: str):
        try:
            user_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid user ID") from exc
        return create_success_response(self.user_service.get_user_by_id(user_id))

    @Put("/{id}")
    @RequirePermission("user:write", "admin")
    @ApiBody(UpdateUserRequest)
    def update(self, id: str, data: dict, user=None):
        try:
            user_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid user ID") from exc
        return create_success_response(self.user_service.update_user(user_id, data or {}))

    @Delete("/{id}")
    @RequirePermission("user:write", "admin")
    def delete(self, id: str):
        try:
            user_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid user ID") from exc
        return create_success_response(self.user_service.delete_user(user_id))
