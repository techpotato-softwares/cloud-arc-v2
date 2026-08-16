from __future__ import annotations

from typing import Any, Protocol

from passlib.hash import bcrypt

from core.di import Inject, injectable
from core.pagination import pagination_meta
from middleware.error_handler import NotFoundError
from modules.platform.src.repositories.user_repository import IUserRepository
from modules.platform.src.types.svc_types import TYPES


class IUserService(Protocol):
    def create_user(self, data: dict[str, Any]) -> dict[str, Any]: ...
    def get_user_by_id(self, user_id: int) -> dict[str, Any]: ...
    def get_all_users(self, params: dict[str, Any]) -> dict[str, Any]: ...
    def update_user(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]: ...
    def delete_user(self, user_id: int) -> dict[str, Any]: ...


@injectable
class UserService:
    def __init__(self, repo: IUserRepository = Inject(TYPES.UserRepository)):
        self.repo = repo

    def create_user(self, data: dict[str, Any]) -> dict[str, Any]:
        payload = {**data, "password": bcrypt.hash(data["password"])}
        return self.repo.create(payload)

    def get_user_by_id(self, user_id: int) -> dict[str, Any]:
        user = self.repo.find_by_id(user_id)
        if not user:
            raise NotFoundError("User not found")
        return user

    def get_all_users(self, params: dict[str, Any]) -> dict[str, Any]:
        rows, total = self.repo.find_all(params)
        return {
            "data": rows,
            "pagination": pagination_meta(params.get("page", 1), params.get("limit", 20), total),
        }

    def update_user(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
        payload = {**data}
        if payload.get("password"):
            payload["password"] = bcrypt.hash(payload["password"])
        return self.repo.update(user_id, payload)

    def delete_user(self, user_id: int) -> dict[str, Any]:
        self.repo.delete(user_id)
        return {"id": user_id, "deleted": True}
