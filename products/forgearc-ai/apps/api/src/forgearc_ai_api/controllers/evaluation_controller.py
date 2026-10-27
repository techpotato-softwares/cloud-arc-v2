from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Get, Post
from forgearc_ai.services import EvaluationService


@Controller
class EvaluationController:
    def __init__(self, evaluations: EvaluationService = Inject("EvaluationService")):
        self.evaluations = evaluations

    @Post("/api/evaluations", permission="ai:evaluate")
    def evaluate(self, principal, body: dict):
        return self.evaluations.evaluate(principal, body)

    @Get("/api/evaluations", permission="ai:read")
    def history(self, principal, _path, _query):
        return self.evaluations.history(principal)
