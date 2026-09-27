from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Protocol

from core.di import Inject, injectable
from database.models import Permission, Role, RolePermission, Tenant, User
from passlib.hash import bcrypt
from sqlmodel import select

from modules.platform.src.types.svc_types import TYPES


@dataclass
class AuthUserRecord:
    user: User
    role_name: str | None
    role_id: int | None
    permissions: list[str]
    tenant_id: int | None
    modules_enabled: list[str] = field(default_factory=lambda: ["platform", "demo", "ai", "files"])


class IAuthRepository(Protocol):
    def find_by_username_or_email(self, username_or_email: str) -> AuthUserRecord | None: ...
    def validate_password(self, user: User, password: str) -> bool: ...


@injectable
class AuthRepository:
    def __init__(self, get_session=Inject(TYPES.SessionFactory)):
        self._get_session = get_session

    def find_by_username_or_email(self, username_or_email: str) -> AuthUserRecord | None:
        with self._get_session() as session:
            user = session.exec(
                select(User).where(
                    ((User.username == username_or_email) | (User.email == username_or_email))
                    & (User.is_active == True)
                )
            ).first()
            if not user:
                return None
            role = session.get(Role, user.role_id) if user.role_id else None
            permission_codes: list[str] = []
            if role:
                rps = session.exec(
                    select(RolePermission).where(
                        RolePermission.role_id == role.role_id,
                        RolePermission.is_active == True,
                    )
                ).all()
                for rp in rps:
                    perm = session.get(Permission, rp.permission_id)
                    if perm and perm.is_active:
                        permission_codes.append(perm.permission_code)
            modules = ["platform", "demo", "ai", "files"]
            if user.tenant_id:
                tenant = session.get(Tenant, user.tenant_id)
                if tenant and tenant.modules_enabled:
                    try:
                        modules = json.loads(tenant.modules_enabled)
                    except Exception:
                        modules = ["platform", "demo", "ai", "files"]
            return AuthUserRecord(
                user=user,
                role_name=role.role_name if role else None,
                role_id=role.role_id if role else None,
                permissions=permission_codes,
                tenant_id=user.tenant_id,
                modules_enabled=modules,
            )

    def validate_password(self, user: User, password: str) -> bool:
        try:
            return bcrypt.verify(password, user.password)
        except Exception:
            return False
