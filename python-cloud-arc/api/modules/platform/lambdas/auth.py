from core.service_registry import define_lambda
from core.handler_factory import create_lambda_handler
from modules.platform.src.controllers.auth_controller import AuthController
from modules.platform.src.controllers.health_controller import HealthController
from modules.platform.src.services.auth_service import AuthService
from modules.platform.src.repositories.auth_repository import AuthRepository
from modules.platform.src.types.svc_types import TYPES

define_lambda(
    name="auth",
    controllers=[AuthController, HealthController],
    bindings=[
        {"symbol": TYPES.AuthService, "implementation": AuthService},
        {"symbol": TYPES.AuthRepository, "implementation": AuthRepository},
    ],
)
handler = create_lambda_handler("auth")
