from __future__ import annotations

from core.di import Inject, injectable
from core.openapi import ApiBody
from decorators import Controller, Post
from decorators.auth_decorators import RequireModule, RequirePermission
from middleware.error_handler import create_success_response

from modules.ai.src.schemas.ai import ChatRequest
from modules.ai.src.services.ai_service import IAiService
from modules.ai.src.types.svc_types import TYPES


@Controller(path="/api/ai", lambda_name="ai")
@injectable
class AiController:
    def __init__(self, service: IAiService = Inject(TYPES.AiService)):
        self.service = service

    @Post("/chat")
    @RequireModule("ai")
    @RequirePermission("ai:chat", "admin")
    @ApiBody(ChatRequest)
    def chat(self, data: dict, user=None):
        message = (data or {}).get("message") or ""
        return create_success_response(self.service.chat(message))
