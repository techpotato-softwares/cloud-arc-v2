from __future__ import annotations

from typing import Any, Protocol

from core.di import Inject, injectable
from core.pagination import pagination_meta

from modules.demo.src.repositories.demo_item_repository import IDemoItemRepository
from modules.demo.src.types.svc_types import TYPES


class IDemoItemService(Protocol):
    def create(self, data: dict[str, Any], user_id: int | None, tenant_id: int | None) -> dict[str, Any]: ...
    def list(self, tenant_id: int | None, params: dict[str, Any] | None = None) -> dict[str, Any]: ...
    def get(self, item_id: int) -> dict[str, Any]: ...
    def update(self, item_id: int, data: dict[str, Any], user_id: int | None) -> dict[str, Any]: ...
    def remove(self, item_id: int) -> None: ...


@injectable
class DemoItemService:
    def __init__(self, repo: IDemoItemRepository = Inject(TYPES.DemoItemRepository)):
        self.repo = repo

    def create(self, data: dict[str, Any], user_id: int | None, tenant_id: int | None) -> dict[str, Any]:
        payload = {**data, "createdById": user_id, "tenantId": tenant_id}
        return self.repo.create(payload)

    def list(self, tenant_id: int | None, params: dict[str, Any] | None = None) -> dict[str, Any]:
        params = params or {"page": 1, "limit": 20}
        rows, total = self.repo.find_all(tenant_id, params)
        return {
            "data": rows,
            "pagination": pagination_meta(params.get("page", 1), params.get("limit", 20), total),
        }

    def get(self, item_id: int) -> dict[str, Any]:
        from middleware.error_handler import NotFoundError

        item = self.repo.find_by_id(item_id)
        if not item:
            raise NotFoundError("Demo item not found")
        return item

    def update(self, item_id: int, data: dict[str, Any], user_id: int | None) -> dict[str, Any]:
        return self.repo.update(item_id, {**data, "updatedById": user_id})

    def remove(self, item_id: int) -> None:
        self.repo.delete(item_id)
