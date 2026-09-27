from __future__ import annotations

from typing import Any, Protocol

from core.di import Inject, injectable
from database.models import Role, User
from middleware.error_handler import NotFoundError
from sqlalchemy import func
from sqlmodel import select

from modules.platform.src.types.svc_types import TYPES


class IUserRepository(Protocol):
    def create(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def find_by_id(self, user_id: int) -> dict[str, Any] | None: ...
    def find_all(self, params: dict[str, Any]) -> tuple[list[dict[str, Any]], int]: ...
    def update(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]: ...
    def delete(self, user_id: int) -> None: ...


def _dump(user: User, role: Role | None) -> dict[str, Any]:
    return {
        "userId": user.user_id,
        "username": user.username,
        "email": user.email,
        "role": role.role_name if role else "",
        "roleId": user.role_id,
        "isActive": user.is_active,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


@injectable
class UserRepository:
    def __init__(self, get_session=Inject(TYPES.SessionFactory)):
        self._get_session = get_session

    def _role_id(self, session, data: dict[str, Any]) -> int | None:
        if data.get("roleId"):
            return data["roleId"]
        name = data.get("role")
        if not name:
            return None
        role = session.exec(select(Role).where(Role.role_name == name, Role.is_active == True)).first()
        return role.role_id if role else None

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        with self._get_session() as session:
            user = User(
                username=data["username"],
                email=data["email"],
                password=data["password"],
                role_id=self._role_id(session, data),
                is_active=data.get("isActive", True),
                tenant_id=data.get("tenantId"),
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            role = session.get(Role, user.role_id) if user.role_id else None
            return _dump(user, role)

    def find_by_id(self, user_id: int) -> dict[str, Any] | None:
        with self._get_session() as session:
            user = session.get(User, user_id)
            if not user:
                return None
            role = session.get(Role, user.role_id) if user.role_id else None
            return _dump(user, role)

    def find_all(self, params: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
        page, limit = params.get("page", 1), params.get("limit", 20)
        with self._get_session() as session:
            q = select(User)
            term = params.get("searchTerm")
            if term:
                key = params.get("searchKey") or "username"
                if key not in ("username", "email"):
                    raise ValueError(f"Invalid search field: {key}")
                col = User.username if key == "username" else User.email
                q = q.where(col.ilike(f"%{term}%"))
            total = session.exec(select(func.count()).select_from(q.subquery())).one()
            sort_col = {"username": User.username, "email": User.email}.get(
                params.get("sortBy"), User.created_at
            )
            q = q.order_by(sort_col.asc() if params.get("sortOrder") == "ASC" else sort_col.desc())
            q = q.offset((page - 1) * limit).limit(limit)
            rows = []
            for user in session.exec(q).all():
                role = session.get(Role, user.role_id) if user.role_id else None
                rows.append(_dump(user, role))
            return rows, int(total)

    def update(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        with self._get_session() as session:
            user = session.get(User, user_id)
            if not user:
                raise NotFoundError("User not found")
            if data.get("email") is not None:
                user.email = data["email"]
            if data.get("password") is not None:
                user.password = data["password"]
            if data.get("isActive") is not None:
                user.is_active = data["isActive"]
            if data.get("roleId") is not None:
                user.role_id = data["roleId"]
            session.add(user)
            session.commit()
            session.refresh(user)
            role = session.get(Role, user.role_id) if user.role_id else None
            return _dump(user, role)

    def delete(self, user_id: int) -> None:
        with self._get_session() as session:
            user = session.get(User, user_id)
            if not user:
                raise NotFoundError("User not found")
            session.delete(user)
            session.commit()
