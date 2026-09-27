from core.handler_factory import create_lambda_handler
from core.service_registry import define_lambda

from modules.ai.src.controllers.ai_controller import AiController
from modules.ai.src.services.ai_service import AiService
from modules.ai.src.types.svc_types import TYPES

define_lambda(
    name="ai",
    controllers=[AiController],
    bindings=[
        {"symbol": TYPES.AiService, "implementation": AiService},
    ],
)
handler = create_lambda_handler("ai")
