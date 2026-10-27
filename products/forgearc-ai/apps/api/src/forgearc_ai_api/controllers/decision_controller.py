from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Post
from forgearc_ai.services import DecisionService


@Controller
class DecisionController:
    def __init__(self, decisions: DecisionService = Inject("DecisionService")):
        self.decisions = decisions

    @Post("/api/decisions/evaluate", permission="ai:decide")
    def evaluate(self, principal, body: dict):
        return self.decisions.evaluate(principal, body)
