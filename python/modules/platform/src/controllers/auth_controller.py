from __future__ import annotations
from passlib.hash import bcrypt
from sqlmodel import select
from decorators import Controller, Post
from decorators.auth_decorators import ApiPublic
from database import get_session
from database.models import User, Role, RolePermission, Permission, Tenant
from utils.webtoken import generate_tokens
from middleware.error_handler import AppError, ValidationError, create_success_response

@Controller(path="/api", lambda_name="auth")
class AuthController:
    @Post("/login")
    @ApiPublic()
    def login(self, data: dict):
        username = (data or {}).get("username")
        password = (data or {}).get("password")
        if not username or not password:
            raise ValidationError("Username and password are required")
        with get_session() as session:
            user = session.exec(
                select(User).where(((User.username == username) | (User.email == username)) & (User.is_active == True))
            ).first()
            if not user or not bcrypt.verify(password, user.password):
                raise AppError("Invalid username or password", 401, "UNAUTHORIZED")
            role = session.get(Role, user.role_id) if user.role_id else None
            permission_codes: list[str] = []
            if role:
                rps = session.exec(select(RolePermission).where(RolePermission.role_id == role.role_id, RolePermission.is_active == True)).all()
                for rp in rps:
                    perm = session.get(Permission, rp.permission_id)
                    if perm and perm.is_active:
                        permission_codes.append(perm.permission_code)
            modules = ["platform", "demo", "ai"]
            if user.tenant_id:
                tenant = session.get(Tenant, user.tenant_id)
                if tenant and tenant.modules_enabled:
                    import json
                    try:
                        modules = json.loads(tenant.modules_enabled)
                    except Exception:
                        modules = ["platform", "demo", "ai"]
            payload = {
                "userId": user.user_id,
                "username": user.username,
                "email": user.email,
                "role": role.role_name if role else None,
                "tenantId": user.tenant_id,
                "permissions": permission_codes,
                "modulesEnabled": modules,
            }
            tokens = generate_tokens(payload)
            return create_success_response({
                "success": True,
                "message": "Login successful",
                **tokens,
                "user": {
                    "userId": user.user_id,
                    "username": user.username,
                    "email": user.email,
                    "roleName": role.role_name if role else None,
                    "permissions": permission_codes,
                },
            })

    @Post("/auth/refresh")
    @ApiPublic()
    def refresh(self, data: dict):
        from utils.webtoken import verify_refresh_token
        token = (data or {}).get("refreshToken")
        if not token:
            raise ValidationError("Refresh token is required")
        decoded = verify_refresh_token(token)
        clean = {k: decoded[k] for k in ("userId", "username", "email", "role", "tenantId", "permissions", "modulesEnabled") if k in decoded}
        tokens = generate_tokens(clean)
        return create_success_response({"success": True, "message": "Token refreshed successfully", **tokens})
