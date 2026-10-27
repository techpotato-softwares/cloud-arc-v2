from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Get
from forgearc_ai.services import UsageService


@Controller
class UsageController:
    def __init__(self, usage: UsageService = Inject("UsageService")):
        self.usage = usage

    @Get("/api/usage", permission="ai:read")
    def summary(self, principal, _path, _query):
        return self.usage.summary(principal)

    @Get("/api/usage/dashboard", permission="ai:read")
    def dashboard(self, principal, _path, query):
        return self.usage.dashboard(principal, query)
