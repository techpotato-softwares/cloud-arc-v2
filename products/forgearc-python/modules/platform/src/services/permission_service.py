from __future__ import annotations

from typing import Any, Protocol

from core.di import Inject, injectable
from core.pagination import pagination_meta
from middleware.error_handler import NotFoundError

from modules.platform.src.repositories.permission_repository import IPermissionRepository
from modules.platform.src.types.svc_types import TYPES


class IPermissionService(Protocol):
    def create_permission(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def get_permission_by_id(self, permission_id: int) -> dict[str, Any]: ...
    def get_all_permissions(self, params: dict[str, Any]) -> dict[str, Any]: ...
    def update_permission(self, permission_id: int, data: dict[str, Any]) -> dict[str, Any]: ...
    def delete_permission(self, permission_id: int) -> bool: ...


@injectable
class PermissionService:
    def __init__(self, repo: IPermissionRepository = Inject(TYPES.PermissionRepository)):
        self.repo = repo

    def create_permission(self, data: dict[str, Any]) -> dict[str, Any]:
        return self.repo.create(data)

    def get_permission_by_id(self, permission_id: int) -> dict[str, Any]:
        perm = self.repo.find_by_id(permission_id)
        if not perm:
            raise NotFoundError(f"Permission with ID {permission_id} not found")
        return perm

    def get_all_permissions(self, params: dict[str, Any]) -> dict[str, Any]:
        rows, total = self.repo.find_all(params)
        return {
            "data": rows,
            "pagination": pagination_meta(params.get("page", 1), params.get("limit", 10), total),
        }

    def update_permission(self, permission_id: int, data: dict[str, Any]) -> dict[str, Any]:
        perm = self.repo.update(permission_id, data)
        if not perm:
            raise NotFoundError(f"Permission with ID {permission_id} not found")
        return perm

    def delete_permission(self, permission_id: int) -> bool:
        if not self.repo.delete(permission_id):
            raise NotFoundError(f"Permission with ID {permission_id} not found")
        return True
