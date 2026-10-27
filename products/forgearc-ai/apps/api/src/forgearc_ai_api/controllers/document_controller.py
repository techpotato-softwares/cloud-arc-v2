from forgearc_ai.config import Settings
from forgearc_ai.di import Inject
from forgearc_ai.errors import PolicyError
from forgearc_ai.routing import Controller, Delete, Post
from forgearc_ai.services import IngestionService


@Controller
class DocumentController:
    def __init__(
        self,
        ingestion: IngestionService = Inject("IngestionService"),
        settings: Settings = Inject("Settings"),
    ):
        self.ingestion = ingestion
        self.settings = settings

    @Post("/api/documents", permission="ai:ingest", multipart=True)
    def upload(self, principal, upload, form):
        filename = getattr(upload, "filename", None) or "document.txt"
        content = upload.file.read() if hasattr(upload, "file") else bytes(upload)
        if len(content) > self.settings.max_upload_bytes:
            raise PolicyError("The uploaded document exceeds the configured limit.")
        corpus = str(form.get("corpusId") or "")
        key = str(form.get("idempotencyKey") or filename)
        return self.ingestion.submit(principal, filename, content, corpus, key)

    @Post("/api/retrieval", permission="ai:read")
    def retrieve(self, principal, body: dict):
        return self.ingestion.retrieve(principal, body.get("query") or "", int(body.get("topK") or 4))

    @Delete("/api/corpora/{corpus_id}", permission="ai:delete")
    def delete_corpus(self, principal, path, _query):
        return self.ingestion.delete_corpus(principal, path["corpus_id"])
