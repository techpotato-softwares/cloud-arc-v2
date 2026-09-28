from __future__ import annotations

from forgearc_ai.auth import login
from forgearc_ai.config import Settings
from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Delete, Get, Post
from forgearc_ai.services import ChatService, DecisionService, IngestionService, UsageService


@Controller
class AuthController:
    def __init__(self, settings: Settings = Inject("Settings")):
        self.settings = settings

    @Post("/api/auth/login", auth=False, module=None, permission=None)
    def login(self, _principal, body: dict):
        token = login(self.settings, body.get("email", ""), body.get("password", ""))
        return {"token": token}


@Controller
class ChatController:
    def __init__(self, chat_service: ChatService = Inject("ChatService")):
        self.chat_service = chat_service

    @Post("/api/ai/chat", permission="ai:chat")
    def chat(self, principal, body: dict):
        return self.chat_service.complete(principal, body)

    @Post("/api/ai/chat/stream", permission="ai:chat", stream=True)
    def stream(self, principal, body: dict):
        return self.chat_service.stream(principal, body)


@Controller
class DocumentController:
    def __init__(self, ingestion: IngestionService = Inject("IngestionService")):
        self.ingestion = ingestion

    @Post("/api/documents", permission="ai:ingest", multipart=True)
    def upload(self, principal, upload, form):
        filename = getattr(upload, "filename", None) or "document.txt"
        content = upload.file.read() if hasattr(upload, "file") else bytes(upload)
        corpus = str(form.get("corpusId") or "")
        key = str(form.get("idempotencyKey") or filename)
        return self.ingestion.submit(principal, filename, content, corpus, key)

    @Post("/api/retrieval", permission="ai:read")
    def retrieve(self, principal, body: dict):
        result = self.ingestion.store.search(
            principal.tenant_id,
            self.ingestion.provider.embed([body.get("query") or ""])[0],
            int(body.get("topK") or 4),
        )
        return {"matches": [chunk.citation() | {"score": round(score, 4)} for score, chunk in result]}

    @Delete("/api/corpora/{corpus_id}", permission="ai:delete")
    def delete_corpus(self, principal, path, _query):
        return self.ingestion.delete_corpus(principal, path["corpus_id"])


@Controller
class JobController:
    def __init__(self, ingestion: IngestionService = Inject("IngestionService")):
        self.ingestion = ingestion

    @Get("/api/jobs/{job_id}", permission="ai:read")
    def status(self, principal, path, _query):
        return self.ingestion.status(principal, path["job_id"])


@Controller
class UsageController:
    def __init__(self, usage: UsageService = Inject("UsageService")):
        self.usage = usage

    @Get("/api/usage", permission="ai:read")
    def summary(self, principal, _path, _query):
        return self.usage.summary(principal)


@Controller
class DecisionController:
    def __init__(self, decisions: DecisionService = Inject("DecisionService")):
        self.decisions = decisions

    @Post("/api/decisions/evaluate", permission="ai:decide")
    def evaluate(self, principal, body: dict):
        return self.decisions.evaluate(principal, body)
