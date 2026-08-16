from core.service_registry import define_lambda
from core.handler_factory import create_lambda_handler
from modules.platform.src.controllers.user_controller import UserController
from modules.platform.src.services.user_service import UserService
from modules.platform.src.repositories.user_repository import UserRepository
from modules.platform.src.types.svc_types import TYPES

define_lambda(
    name="user",
    controllers=[UserController],
    bindings=[
        {"symbol": TYPES.UserService, "implementation": UserService},
        {"symbol": TYPES.UserRepository, "implementation": UserRepository},
    ],
)
handler = create_lambda_handler("user")
