from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Get, Post
from forgearc_ai.services import AgentService


@Controller
class ApprovalController:
    def __init__(self, agents: AgentService = Inject("AgentService")):
        self.agents = agents

    @Get("/api/approvals", permission="ai:read")
    def pending(self, principal, _path, query):
        return self.agents.list_approvals(principal, query)

    @Post("/api/approvals/{approval_id}", permission="ai:approve")
    def decide(self, principal, path, body: dict):
        return self.agents.decide(principal, path["approval_id"], body)
