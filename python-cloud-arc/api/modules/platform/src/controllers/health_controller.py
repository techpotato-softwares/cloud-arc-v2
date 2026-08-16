from __future__ import annotations

from decorators import Controller, Get
from decorators.auth_decorators import ApiPublic
from core.di import injectable
from middleware.error_handler import create_success_response


@Controller(path="/health", lambda_name="auth")
@injectable
class HealthController:
    @Get("/")
    @ApiPublic()
    def health(self):
        return create_success_response({"status": "ok", "product": "arcforge-python"})
