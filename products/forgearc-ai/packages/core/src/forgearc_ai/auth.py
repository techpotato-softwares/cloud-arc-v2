from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from forgearc_ai.config import Settings
from forgearc_ai.errors import Forbidden, Unauthorized


@dataclass
class Principal:
    email: str
    tenant_id: str
    permissions: list[str]
    modules: list[str]


def _password_digest(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def login(settings: Settings, email: str, password: str) -> str:
    user = next((item for item in settings.local_users if item.email == email), None)
    if user is None or not hmac.compare_digest(_password_digest(user.password), _password_digest(password)):
        raise Unauthorized("Email or password is not valid.")
    return issue_token(
        settings,
        Principal(user.email, user.tenant_id, list(user.permissions), list(user.modules)),
    )


def issue_token(settings: Settings, principal: Principal) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": principal.email,
        "tenant_id": principal.tenant_id,
        "permissions": principal.permissions,
        "modules": principal.modules,
        "iss": settings.auth.issuer,
        "aud": settings.auth.audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.auth.expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.auth.jwt_secret, algorithm="HS256")


def read_token(settings: Settings, header: str) -> Principal:
    if not header.startswith("Bearer "):
        raise Unauthorized("A Bearer token is required.")
    try:
        payload = jwt.decode(
            header.removeprefix("Bearer ").strip(),
            settings.auth.jwt_secret,
            algorithms=["HS256"],
            audience=settings.auth.audience,
            issuer=settings.auth.issuer,
        )
    except jwt.PyJWTError as exc:
        raise Unauthorized("The token is not valid.") from exc
    return Principal(
        email=payload.get("sub", ""),
        tenant_id=payload.get("tenant_id", ""),
        permissions=list(payload.get("permissions") or []),
        modules=list(payload.get("modules") or []),
    )


def require_access(principal: Principal, module: str | None, permission: str | None) -> None:
    if module and module not in principal.modules:
        raise Forbidden(f"The {module} module is not enabled for this token.")
    if permission and permission not in principal.permissions and "admin" not in principal.permissions:
        raise Forbidden(f"Missing permission {permission}.")
