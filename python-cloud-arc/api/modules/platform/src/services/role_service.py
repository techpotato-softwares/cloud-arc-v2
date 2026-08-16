from __future__ import annotations

from typing import Any, Protocol

from core.di import Inject, injectable
from core.pagination import pagination_meta
from middleware.error_handler import NotFoundError
from modules.platform.src.repositories.role_repository import IRoleRepository
from modules.platform.src.types.svc_types import TYPES


class IRoleService(Protocol):
    def create_role(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def get_role_by_id(self, role_id: int) -> dict[str, Any]: ...
    def get_all_roles(self, params: dict[str, Any]) -> dict[str, Any]: ...
    def update_role(self, role_id: int, data: dict[str, Any]) -> dict[str, Any]: ...
    def delete_role(self, role_id: int) -> bool: ...


@injectable
class RoleService:
    def __init__(self, repo: IRoleRepository = Inject(TYPES.RoleRepository)):
        self.repo = repo

    def create_role(self, data: dict[str, Any]) -> dict[str, Any]:
        return self.repo.create(data)

    def get_role_by_id(self, role_id: int) -> dict[str, Any]:
        role = self.repo.find_by_id(role_id)
        if not role:
            raise NotFoundError(f"Role {role_id} not found")
        return role

    def get_all_roles(self, params: dict[str, Any]) -> dict[str, Any]:
        rows, total = self.repo.find_all(params)
        return {
            "data": rows,
            "pagination": pagination_meta(params.get("page", 1), params.get("limit", 20), total),
        }

    def update_role(self, role_id: int, data: dict[str, Any]) -> dict[str, Any]:
        role = self.repo.update(role_id, data)
        if not role:
            raise NotFoundError(f"Role {role_id} not found")
        return role

    def delete_role(self, role_id: int) -> bool:
        if not self.repo.delete(role_id):
            raise NotFoundError(f"Role {role_id} not found")
        return True
