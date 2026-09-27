from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str | None = None
    roleId: int | None = None
    isActive: bool = True


class UpdateUserRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    roleId: int | None = None
    isActive: bool | None = None


class CreateRoleRequest(BaseModel):
    roleName: str
    description: str = ""
    isActive: bool = True
    permissionIds: list[int] = Field(default_factory=list)


class UpdateRoleRequest(BaseModel):
    roleName: str | None = None
    description: str | None = None
    isActive: bool | None = None
    permissionIds: list[int] | None = None


class CreatePermissionRequest(BaseModel):
    permissionCode: str
    permissionName: str
    description: str = ""
    isActive: bool = True


class UpdatePermissionRequest(BaseModel):
    permissionName: str | None = None
    description: str | None = None
    isActive: bool | None = None
