from forgearc_ai.auth import login
from forgearc_ai.config import Settings
from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Post


@Controller
class AuthController:
    def __init__(self, settings: Settings = Inject("Settings")):
        self.settings = settings

    @Post("/api/auth/login", auth=False, module=None, permission=None)
    def login(self, _principal, body: dict):
        token = login(self.settings, body.get("email", ""), body.get("password", ""))
        return {"token": token}
