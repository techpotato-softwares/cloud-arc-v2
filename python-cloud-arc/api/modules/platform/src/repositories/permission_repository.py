from __future__ import annotations

from typing import Any, Protocol

from sqlalchemy import func
from sqlmodel import select

from core.di import Inject, injectable
from database.models import Permission
from modules.platform.src.types.svc_types import TYPES


class IPermissionRepository(Protocol):
    def create(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def find_by_id(self, permission_id: int) -> dict[str, Any] | None: ...
    def find_all(self, params: dict[str, Any]) -> tuple[list[dict[str, Any]], int]: ...
    def update(self, permission_id: int, data: dict[str, Any]) -> dict[str, Any] | None: ...
    def delete(self, permission_id: int) -> bool: ...


def _dump(perm: Permission) -> dict[str, Any]:
    return {
        "permissionId": perm.permission_id,
        "permissionCode": perm.permission_code,
        "permissionName": perm.permission_name,
        "description": perm.description,
        "isActive": perm.is_active,
        "createdAt": perm.created_at.isoformat() if perm.created_at else None,
        "updatedAt": perm.updated_at.isoformat() if perm.updated_at else None,
    }


@injectable
class PermissionRepository:
    def __init__(self, get_session=Inject(TYPES.SessionFactory)):
        self._get_session = get_session

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        with self._get_session() as session:
            perm = Permission(
                permission_code=data["permissionCode"],
                permission_name=data["permissionName"],
                description=data.get("description") or "",
                is_active=data.get("isActive", True),
            )
            session.add(perm)
            session.commit()
            session.refresh(perm)
            return _dump(perm)

    def find_by_id(self, permission_id: int) -> dict[str, Any] | None:
        with self._get_session() as session:
            perm = session.get(Permission, permission_id)
            return _dump(perm) if perm else None

    def find_all(self, params: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
        page, limit = params.get("page", 1), params.get("limit", 10)
        with self._get_session() as session:
            q = select(Permission)
            if params.get("isActive") is not None:
                q = q.where(Permission.is_active == params["isActive"])
            term = params.get("searchTerm")
            if term:
                q = q.where(Permission.permission_code.ilike(f"%{term}%"))
            total = int(session.exec(select(func.count()).select_from(q.subquery())).one())
            q = q.order_by(Permission.created_at.desc()).offset((page - 1) * limit).limit(limit)
            return [_dump(p) for p in session.exec(q).all()], total

    def update(self, permission_id: int, data: dict[str, Any]) -> dict[str, Any] | None:
        with self._get_session() as session:
            perm = session.get(Permission, permission_id)
            if not perm:
                return None
            if data.get("permissionName") is not None:
                perm.permission_name = data["permissionName"]
            if data.get("description") is not None:
                perm.description = data["description"]
            if data.get("isActive") is not None:
                perm.is_active = data["isActive"]
            session.add(perm)
            session.commit()
            session.refresh(perm)
            return _dump(perm)

    def delete(self, permission_id: int) -> bool:
        with self._get_session() as session:
            perm = session.get(Permission, permission_id)
            if not perm:
                return False
            session.delete(perm)
            session.commit()
            return True
