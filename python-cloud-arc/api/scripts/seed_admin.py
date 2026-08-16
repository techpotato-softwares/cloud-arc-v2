#!/usr/bin/env python3
"""Seed admin user, role, and permissions. Non-interactive: --mode=full (default)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT / "layers" / "shared" / "python" / "src"))
os.environ.setdefault("IS_LOCAL", "true")

from passlib.hash import bcrypt
from sqlmodel import select

from database import get_session, init_db
from database.models import Permission, Role, RolePermission, User

PERMISSIONS = [
    ("admin", "Admin", "Full administrative access"),
    ("user:create", "User Create", "Create users"),
    ("user:write", "User Write", "Update users"),
    ("user:read", "User Read", "Read users"),
    ("demo:read", "Demo Read", "Read demo items"),
    ("demo:write", "Demo Write", "Write demo items"),
    ("ai:chat", "AI Chat", "Use AI chat endpoint"),
    ("role:write", "Role Write", "Manage roles"),
    ("permission:write", "Permission Write", "Manage permissions"),
    ("files:read", "Files Read", "Download files"),
    ("files:write", "Files Write", "Upload files"),
]


def main() -> None:
    init_db()
    username = os.environ.get("ADMIN_USERNAME", "admin")
    email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    password = os.environ.get("ADMIN_PASSWORD", "admin")
    with get_session() as session:
        codes = {}
        for code, name, desc in PERMISSIONS:
            perm = session.exec(select(Permission).where(Permission.permission_code == code)).first()
            if not perm:
                perm = Permission(permission_code=code, permission_name=name, description=desc)
                session.add(perm)
                session.flush()
            codes[code] = perm.permission_id
        role = session.exec(select(Role).where(Role.role_name == "admin")).first()
        if not role:
            role = Role(role_name="admin", description="Administrator")
            session.add(role)
            session.flush()
        existing = {
            rp.permission_id
            for rp in session.exec(select(RolePermission).where(RolePermission.role_id == role.role_id)).all()
        }
        for pid in codes.values():
            if pid not in existing:
                session.add(RolePermission(role_id=role.role_id, permission_id=pid, is_active=True))
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            user = User(
                username=username,
                email=email,
                password=bcrypt.hash(password),
                role_id=role.role_id,
                is_active=True,
            )
            session.add(user)
        else:
            user.password = bcrypt.hash(password)
            user.role_id = role.role_id
            session.add(user)
        session.commit()
    print(f"Seeded admin user '{username}' / role admin / {len(PERMISSIONS)} permissions")


if __name__ == "__main__":
    main()
