from __future__ import annotations

from decorators import Controller, Get, Post, Put, Delete
from decorators.auth_decorators import RequirePermission
from core.di import Inject, injectable
from core.openapi import ApiBody
from core.pagination import parse_list_query
from middleware.error_handler import ValidationError, create_success_response
from modules.platform.src.schemas.auth import CreatePermissionRequest, UpdatePermissionRequest
from modules.platform.src.services.permission_service import IPermissionService
from modules.platform.src.types.svc_types import TYPES


@Controller(path="/api/permission", lambda_name="permission")
@injectable
class PermissionController:
    def __init__(self, permission_service: IPermissionService = Inject(TYPES.PermissionService)):
        self.permission_service = permission_service

    @Post("/")
    @RequirePermission("permission:write", "admin")
    @ApiBody(CreatePermissionRequest)
    def create(self, data: dict, user=None):
        return create_success_response(self.permission_service.create_permission(data or {}), 201)

    @Get("/")
    @RequirePermission("permission:write", "admin")
    def get_all(self, event=None):
        params = parse_list_query((event or {}).get("queryStringParameters"), default_limit=10)
        return create_success_response(self.permission_service.get_all_permissions(params))

    @Get("/{id}")
    @RequirePermission("permission:write", "admin")
    def get_by_id(self, id: str):
        try:
            permission_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid permission ID") from exc
        return create_success_response(self.permission_service.get_permission_by_id(permission_id))

    @Put("/{id}")
    @RequirePermission("permission:write", "admin")
    @ApiBody(UpdatePermissionRequest)
    def update(self, id: str, data: dict, user=None):
        try:
            permission_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid permission ID") from exc
        return create_success_response(
            self.permission_service.update_permission(permission_id, data or {})
        )

    @Delete("/{id}")
    @RequirePermission("permission:write", "admin")
    def delete(self, id: str):
        try:
            permission_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid permission ID") from exc
        self.permission_service.delete_permission(permission_id)
        return create_success_response({"permissionId": permission_id, "deleted": True})
