from __future__ import annotations

import base64
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from forgearc_ai.auth import read_token, require_access
from forgearc_ai.config import Settings, load_settings, validate_settings
from forgearc_ai.di import Container
from forgearc_ai.errors import ForgeArcError, PolicyError
from forgearc_ai.routing import route_registry
from forgearc_ai_api.wiring import build_container

import forgearc_ai_api.controllers  # noqa: F401


def create_app(settings: Settings | None = None, container: Container | None = None) -> FastAPI:
    resolved = validate_settings(settings) if settings is not None else load_settings()
    graph = container or build_container(resolved)
    app = FastAPI(title="ForgeArc AI", version="1.0.0")
    app.state.container = graph

    @app.get("/health")
    def health():
        return {"status": "ok", "product": "forgearc-ai"}

    @app.post("/internal/pubsub", include_in_schema=False)
    async def pubsub_worker(request: Request):
        envelope = await request.json()
        encoded = ((envelope.get("message") or {}).get("data") or "").strip()
        if not encoded:
            raise HTTPException(400, "Pub/Sub message data is required.")
        try:
            decoded = base64.b64decode(encoded, validate=True).decode().strip()
        except (ValueError, UnicodeDecodeError) as exc:
            raise HTTPException(400, "Pub/Sub message data is invalid.") from exc
        try:
            payload = json.loads(decoded)
        except json.JSONDecodeError:
            payload = decoded
        job_id = payload.get("jobId", "") if isinstance(payload, dict) else payload
        if not job_id:
            raise HTTPException(400, "Pub/Sub job id is required.")
        graph.get("IngestionService").process_message(payload)
        return {"ok": True, "jobId": job_id}

    @app.exception_handler(ForgeArcError)
    async def handle_error(_, exc: ForgeArcError):
        return JSONResponse({"error": exc.code, "message": str(exc)}, status_code=exc.status)

    for cls, spec in route_registry.routes:
        app.add_api_route(spec.path, _endpoint(graph, resolved, cls, spec), methods=[spec.method])
    return app


def _endpoint(container: Container, settings: Settings, cls: type, spec):
    async def handle(request: Request):
        principal = None
        if spec.auth:
            principal = read_token(settings, request.headers.get("authorization", ""))
            require_access(principal, spec.module, spec.permission)
        controller = container.resolve(cls)
        method = getattr(controller, spec.handler_name)
        if spec.multipart:
            form = await request.form()
            upload = form.get("file")
            if upload is None:
                raise PolicyError("A file upload is required.")
            return method(principal, upload, form)
        if spec.kind == "get":
            return method(principal, request.path_params, dict(request.query_params))
        body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
        if spec.stream:
            return StreamingResponse(method(principal, body), media_type="text/event-stream")
        return method(principal, body)

    names = [part[1:-1] for part in spec.path.split("/") if part.startswith("{") and part.endswith("}")]
    signature = "request: Request" + "".join(f", {name}: str" for name in names)
    namespace = {"Request": Request, "handle": handle}
    exec(f"async def endpoint({signature}):\n    return await handle(request)\n", namespace)
    return namespace["endpoint"]


def write_manifest(path: Path) -> dict:
    payload = route_registry.manifest()
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


app = create_app()
