from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Get, Post
from forgearc_ai.services import AgentService


@Controller
class AgentController:
    def __init__(self, agents: AgentService = Inject("AgentService")):
        self.agents = agents

    @Post("/api/agents/run", permission="ai:agent")
    def run(self, principal, body: dict):
        return self.agents.run(principal, body)

    @Post("/api/agents/supervise", permission="ai:agent")
    def supervise(self, principal, body: dict):
        return self.agents.supervise(principal, body)

    @Get("/api/agents/runs/{run_id}", permission="ai:read")
    def get_run(self, principal, path, _query):
        return self.agents.get_run(principal, path["run_id"])
