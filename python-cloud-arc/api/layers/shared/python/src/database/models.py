from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class Tenant(SQLModel, table=True):
    __tablename__ = "tenants"
    tenant_id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    # JSON-encoded list, e.g. '["platform","demo","ai"]'
    modules_enabled: str = Field(default='["platform","demo","ai","files"]')
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class User(SQLModel, table=True):
    __tablename__ = "users"
    user_id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenants.tenant_id")
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    password: str
    role_id: Optional[int] = Field(default=None, foreign_key="roles.role_id")
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Role(SQLModel, table=True):
    __tablename__ = "roles"
    role_id: Optional[int] = Field(default=None, primary_key=True)
    role_name: str
    description: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Permission(SQLModel, table=True):
    __tablename__ = "permissions"
    permission_id: Optional[int] = Field(default=None, primary_key=True)
    permission_code: str = Field(unique=True, index=True)
    permission_name: str
    description: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permissions"
    role_permission_id: Optional[int] = Field(default=None, primary_key=True)
    role_id: int = Field(foreign_key="roles.role_id")
    permission_id: int = Field(foreign_key="permissions.permission_id")
    is_active: bool = True

class DemoItem(SQLModel, table=True):
    __tablename__ = "demo_items"
    item_id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    status: str = "active"
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
