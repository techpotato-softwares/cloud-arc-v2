from __future__ import annotations

from typing import Any, Protocol

from core.di import Inject, injectable
from database.models import Permission, Role, RolePermission
from sqlalchemy import func
from sqlmodel import select

from modules.platform.src.types.svc_types import TYPES


class IRoleRepository(Protocol):
    def create(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def find_by_id(self, role_id: int) -> dict[str, Any] | None: ...
    def find_all(self, params: dict[str, Any]) -> tuple[list[dict[str, Any]], int]: ...
    def update(self, role_id: int, data: dict[str, Any]) -> dict[str, Any] | None: ...
    def delete(self, role_id: int) -> bool: ...


def _permissions(session, role_id: int) -> list[dict[str, Any]]:
    rps = session.exec(
        select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.is_active == True,
        )
    ).all()
    out = []
    for rp in rps:
        perm = session.get(Permission, rp.permission_id)
        if perm:
            out.append(
                {
                    "permissionId": perm.permission_id,
                    "permissionCode": perm.permission_code,
                    "permissionName": perm.permission_name,
                    "description": perm.description,
                    "isActive": perm.is_active,
                }
            )
    return out


def _dump(session, role: Role) -> dict[str, Any]:
    return {
        "roleId": role.role_id,
        "roleName": role.role_name,
        "description": role.description,
        "isActive": role.is_active,
        "permissions": _permissions(session, role.role_id),
        "createdAt": role.created_at.isoformat() if role.created_at else None,
        "updatedAt": role.updated_at.isoformat() if role.updated_at else None,
    }


@injectable
class RoleRepository:
    def __init__(self, get_session=Inject(TYPES.SessionFactory)):
        self._get_session = get_session

    def _sync_permissions(self, session, role_id: int, permission_ids: list[int]) -> None:
        existing = session.exec(select(RolePermission).where(RolePermission.role_id == role_id)).all()
        for row in existing:
            session.delete(row)
        for pid in permission_ids:
            session.add(RolePermission(role_id=role_id, permission_id=pid, is_active=True))

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        with self._get_session() as session:
            role = Role(
                role_name=data["roleName"],
                description=data.get("description") or "",
                is_active=data.get("isActive", True),
            )
            session.add(role)
            session.commit()
            session.refresh(role)
            ids = data.get("permissionIds") or []
            if ids:
                self._sync_permissions(session, role.role_id, ids)
                session.commit()
            return _dump(session, role)

    def find_by_id(self, role_id: int) -> dict[str, Any] | None:
        with self._get_session() as session:
            role = session.get(Role, role_id)
            return _dump(session, role) if role else None

    def find_all(self, params: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
        page, limit = params.get("page", 1), params.get("limit", 20)
        with self._get_session() as session:
            q = select(Role)
            if params.get("isActive") is not None:
                q = q.where(Role.is_active == params["isActive"])
            term = params.get("searchTerm")
            if term:
                q = q.where(Role.role_name.ilike(f"%{term}%"))
            count_q = select(func.count()).select_from(q.subquery())
            total = int(session.exec(count_q).one())
            sort_col = Role.role_name if params.get("sortBy") == "roleName" else Role.created_at
            q = q.order_by(sort_col.asc() if params.get("sortOrder") == "ASC" else sort_col.desc())
            q = q.offset((page - 1) * limit).limit(limit)
            return [_dump(session, r) for r in session.exec(q).all()], total

    def update(self, role_id: int, data: dict[str, Any]) -> dict[str, Any] | None:
        with self._get_session() as session:
            role = session.get(Role, role_id)
            if not role:
                return None
            if data.get("roleName") is not None:
                role.role_name = data["roleName"]
            if data.get("description") is not None:
                role.description = data["description"]
            if data.get("isActive") is not None:
                role.is_active = data["isActive"]
            if data.get("permissionIds") is not None:
                self._sync_permissions(session, role_id, data["permissionIds"])
            session.add(role)
            session.commit()
            session.refresh(role)
            return _dump(session, role)

    def delete(self, role_id: int) -> bool:
        with self._get_session() as session:
            role = session.get(Role, role_id)
            if not role:
                return False
            for rp in session.exec(select(RolePermission).where(RolePermission.role_id == role_id)).all():
                session.delete(rp)
            session.delete(role)
            session.commit()
            return True
