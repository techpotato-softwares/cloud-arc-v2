from core.service_registry import define_lambda
from core.handler_factory import create_lambda_handler
from modules.platform.src.controllers.permission_controller import PermissionController
from modules.platform.src.services.permission_service import PermissionService
from modules.platform.src.repositories.permission_repository import PermissionRepository
from modules.platform.src.types.svc_types import TYPES

define_lambda(
    name="permission",
    controllers=[PermissionController],
    bindings=[
        {"symbol": TYPES.PermissionService, "implementation": PermissionService},
        {"symbol": TYPES.PermissionRepository, "implementation": PermissionRepository},
    ],
)
handler = create_lambda_handler("permission")
