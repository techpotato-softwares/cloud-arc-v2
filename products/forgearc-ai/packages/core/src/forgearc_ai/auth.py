from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from jwt import PyJWKClient

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
    if settings.auth.mode != "local":
        raise Unauthorized("Password login is disabled; use the configured OIDC provider.")
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
    token = header.removeprefix("Bearer ").strip()
    if settings.auth.mode == "oidc":
        return _read_oidc_token(settings, token)
    try:
        payload = jwt.decode(
            token,
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


_JWKS_CLIENTS: dict[str, PyJWKClient] = {}


def _read_oidc_token(settings: Settings, token: str) -> Principal:
    try:
        client = _JWKS_CLIENTS.setdefault(
            settings.auth.jwks_url,
            PyJWKClient(settings.auth.jwks_url, cache_keys=True),
        )
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            issuer=settings.auth.issuer,
            options={"verify_aud": False},
        )
    except (jwt.PyJWTError, ValueError) as exc:
        raise Unauthorized("The OIDC token is not valid.") from exc

    audiences = _claim_values(payload.get("aud"))
    audiences.extend(_claim_values(payload.get("client_id")))
    if settings.auth.audience not in audiences:
        raise Unauthorized("The OIDC token audience is not valid.")
    tenant_id = str(payload.get(settings.auth.tenant_claim) or "")
    if not tenant_id:
        raise Unauthorized("The OIDC token does not contain a tenant claim.")

    permissions = _claim_values(
        payload.get(settings.auth.permissions_claim)
    )
    permissions.extend(_claim_values(payload.get("scope")))
    groups = _claim_values(payload.get(settings.auth.groups_claim))
    for group in groups:
        permissions.extend(settings.auth.group_permissions.get(group, []))
    modules = _claim_values(payload.get(settings.auth.modules_claim))
    if not modules:
        modules = list(settings.auth.default_modules)
    return Principal(
        email=str(
            payload.get("email")
            or payload.get("username")
            or payload.get("sub")
            or ""
        ),
        tenant_id=tenant_id,
        permissions=list(dict.fromkeys(permissions)),
        modules=list(dict.fromkeys(modules)),
    )


def _claim_values(value) -> list[str]:
    if isinstance(value, str):
        return [item for item in value.replace(",", " ").split() if item]
    if isinstance(value, list):
        return [str(item) for item in value if item]
    return []


def require_access(principal: Principal, module: str | None, permission: str | None) -> None:
    if module and module not in principal.modules:
        raise Forbidden(f"The {module} module is not enabled for this token.")
    if permission and permission not in principal.permissions and "admin" not in principal.permissions:
        raise Forbidden(f"Missing permission {permission}.")
