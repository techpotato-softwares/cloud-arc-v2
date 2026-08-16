from core.service_registry import define_lambda
from core.handler_factory import create_lambda_handler
from modules.platform.src.controllers.role_controller import RoleController
from modules.platform.src.services.role_service import RoleService
from modules.platform.src.repositories.role_repository import RoleRepository
from modules.platform.src.types.svc_types import TYPES

define_lambda(
    name="role",
    controllers=[RoleController],
    bindings=[
        {"symbol": TYPES.RoleService, "implementation": RoleService},
        {"symbol": TYPES.RoleRepository, "implementation": RoleRepository},
    ],
)
handler = create_lambda_handler("role")
