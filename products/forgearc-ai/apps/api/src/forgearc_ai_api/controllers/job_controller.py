from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Get
from forgearc_ai.services import IngestionService


@Controller
class JobController:
    def __init__(self, ingestion: IngestionService = Inject("IngestionService")):
        self.ingestion = ingestion

    @Get("/api/jobs/{job_id}", permission="ai:read")
    def status(self, principal, path, _query):
        return self.ingestion.status(principal, path["job_id"])
