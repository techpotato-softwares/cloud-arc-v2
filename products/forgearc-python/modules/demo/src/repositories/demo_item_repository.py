from __future__ import annotations

from typing import Any, Protocol

from core.di import Inject, injectable
from database.models import DemoItem
from middleware.error_handler import NotFoundError
from sqlalchemy import func
from sqlmodel import select

from modules.demo.src.types.svc_types import TYPES


class IDemoItemRepository(Protocol):
    def create(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def find_all(self, tenant_id: int | None = None, params: dict[str, Any] | None = None) -> tuple[list[dict[str, Any]], int]: ...
    def find_by_id(self, item_id: int) -> dict[str, Any] | None: ...
    def update(self, item_id: int, data: dict[str, Any]) -> dict[str, Any]: ...
    def delete(self, item_id: int) -> None: ...


@injectable
class DemoItemRepository:
    def __init__(self, get_session=Inject(TYPES.SessionFactory)):
        self._get_session = get_session

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        with self._get_session() as session:
            item = DemoItem(
                title=data["title"],
                description=data.get("description"),
                status=data.get("status") or "active",
                tenant_id=data.get("tenantId"),
                created_by=data.get("createdById"),
                updated_by=data.get("createdById"),
            )
            session.add(item)
            session.commit()
            session.refresh(item)
            return item.model_dump()

    def find_all(self, tenant_id: int | None = None, params: dict[str, Any] | None = None) -> tuple[list[dict[str, Any]], int]:
        params = params or {}
        page, limit = params.get("page", 1), params.get("limit", 20)
        with self._get_session() as session:
            q = select(DemoItem)
            if tenant_id is not None:
                q = q.where(DemoItem.tenant_id == tenant_id)
            total = int(session.exec(select(func.count()).select_from(q.subquery())).one())
            q = q.order_by(DemoItem.created_at.desc()).offset((page - 1) * limit).limit(limit)
            return [i.model_dump() for i in session.exec(q).all()], total

    def find_by_id(self, item_id: int) -> dict[str, Any] | None:
        with self._get_session() as session:
            item = session.get(DemoItem, item_id)
            return item.model_dump() if item else None

    def update(self, item_id: int, data: dict[str, Any]) -> dict[str, Any]:
        with self._get_session() as session:
            item = session.get(DemoItem, item_id)
            if not item:
                raise NotFoundError("Demo item not found")
            for key in ("title", "description", "status"):
                if key in data and data[key] is not None:
                    setattr(item, key, data[key])
            if "updatedById" in data:
                item.updated_by = data["updatedById"]
            session.add(item)
            session.commit()
            session.refresh(item)
            return item.model_dump()

    def delete(self, item_id: int) -> None:
        with self._get_session() as session:
            item = session.get(DemoItem, item_id)
            if not item:
                raise NotFoundError("Demo item not found")
            session.delete(item)
            session.commit()
