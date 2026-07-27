"""
FastAPI local development server for ArcForge Python.
Wraps the same Lambda handlers used in AWS.

From api/:
  uvicorn src.dev_server:app --reload --port 4001
"""
from __future__ import annotations
import os
import sys
from pathlib import Path

# api/ root
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "layers" / "shared" / "python" / "src"))
sys.path.insert(0, str(ROOT))

os.environ.setdefault("IS_LOCAL", "true")

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

import modules.platform.lambdas.auth  # noqa: F401
import modules.demo.lambdas.demo  # noqa: F401
import modules.ai.lambdas.ai  # noqa: F401

from modules.platform.lambdas.auth import handler as auth_handler
from modules.demo.lambdas.demo import handler as demo_handler
from modules.ai.lambdas.ai import handler as ai_handler

HANDLERS = {
    "auth": auth_handler,
    "demo": demo_handler,
    "ai": ai_handler,
}

ROUTE_MAP = [
    ("/api/login", "auth"),
    ("/api/auth", "auth"),
    ("/api/demo", "demo"),
    ("/api/ai", "ai"),
]

app = FastAPI(title="ArcForge Python API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def pick_handler(path: str):
    for prefix, name in ROUTE_MAP:
        if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix):
            return HANDLERS[name]
    return auth_handler

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def catch_all(request: Request, full_path: str):
    path = "/" + full_path
    body = await request.body()
    event = {
        "httpMethod": request.method,
        "path": path,
        "headers": dict(request.headers),
        "queryStringParameters": dict(request.query_params) or None,
        "body": body.decode("utf-8") if body else None,
        "isBase64Encoded": False,
    }
    result = pick_handler(path)(event, None)
    return Response(
        content=result.get("body") or "",
        status_code=result.get("statusCode", 200),
        headers=result.get("headers") or {"Content-Type": "application/json"},
        media_type="application/json",
    )

@app.get("/health")
def health():
    return {"status": "ok", "product": "arcforge-python"}
