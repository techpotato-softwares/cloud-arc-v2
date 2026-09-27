from __future__ import annotations

from core.di import Inject, injectable
from core.openapi import ApiBody
from core.pagination import parse_list_query
from decorators import Controller, Delete, Get, Post, Put
from decorators.auth_decorators import RequirePermission
from middleware.error_handler import ValidationError, create_success_response

from modules.platform.src.schemas.auth import CreateRoleRequest, UpdateRoleRequest
from modules.platform.src.services.role_service import IRoleService
from modules.platform.src.types.svc_types import TYPES


@Controller(path="/api/role", lambda_name="role")
@injectable
class RoleController:
    def __init__(self, service: IRoleService = Inject(TYPES.RoleService)):
        self.service = service

    @Post("/")
    @RequirePermission("role:write", "admin")
    @ApiBody(CreateRoleRequest)
    def create(self, data: dict, user=None):
        return create_success_response(self.service.create_role(data or {}), 201)

    @Get("/")
    @RequirePermission("role:write", "admin")
    def get_all(self, event=None):
        params = parse_list_query((event or {}).get("queryStringParameters"))
        qs = (event or {}).get("queryStringParameters") or {}
        if qs.get("isActive") not in (None, ""):
            params["isActive"] = str(qs.get("isActive")).lower() == "true"
        return create_success_response(self.service.get_all_roles(params))

    @Get("/{id}")
    @RequirePermission("role:write", "admin")
    def get_by_id(self, id: str):
        try:
            role_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid role ID") from exc
        return create_success_response(self.service.get_role_by_id(role_id))

    @Put("/{id}")
    @RequirePermission("role:write", "admin")
    @ApiBody(UpdateRoleRequest)
    def update(self, id: str, data: dict, user=None):
        try:
            role_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid role ID") from exc
        return create_success_response(self.service.update_role(role_id, data or {}))

    @Delete("/{id}")
    @RequirePermission("role:write", "admin")
    def delete(self, id: str):
        try:
            role_id = int(id)
        except ValueError as exc:
            raise ValidationError("Invalid role ID") from exc
        self.service.delete_role(role_id)
        return create_success_response({"id": role_id, "deleted": True})
