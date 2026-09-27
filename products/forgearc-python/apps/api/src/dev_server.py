"""
FastAPI local development server for ForgeArc Python.
Wraps the same Lambda handlers used in AWS.

From the repository root:
  uv run --package forgearc-python-api uvicorn apps.api.src.dev_server:app --reload --port 4001
"""
from __future__ import annotations
import os
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
PRODUCT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PRODUCT_ROOT))
sys.path.insert(0, str(PRODUCT_ROOT / "packages" / "shared" / "src"))
sys.path.insert(0, str(API_ROOT))

os.environ.setdefault("IS_LOCAL", "true")

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from core.request_context import allowed_origins

import modules.platform.lambdas.auth  # noqa: F401
import modules.platform.lambdas.user  # noqa: F401
import modules.platform.lambdas.role  # noqa: F401
import modules.platform.lambdas.permission  # noqa: F401
import modules.demo.lambdas.demo  # noqa: F401
import modules.ai.lambdas.ai  # noqa: F401
import modules.files.lambdas.files  # noqa: F401

from modules.platform.lambdas.auth import handler as auth_handler
from modules.platform.lambdas.user import handler as user_handler
from modules.platform.lambdas.role import handler as role_handler
from modules.platform.lambdas.permission import handler as permission_handler
from modules.demo.lambdas.demo import handler as demo_handler
from modules.ai.lambdas.ai import handler as ai_handler
from modules.files.lambdas.files import handler as files_handler

HANDLERS = {
    "auth": auth_handler,
    "user": user_handler,
    "role": role_handler,
    "permission": permission_handler,
    "demo": demo_handler,
    "ai": ai_handler,
    "files": files_handler,
}

ROUTE_MAP = [
    ("/health", "auth"),
    ("/api/login", "auth"),
    ("/api/auth", "auth"),
    ("/api/user", "user"),
    ("/api/role", "role"),
    ("/api/permission", "permission"),
    ("/api/demo", "demo"),
    ("/api/ai", "ai"),
    ("/api/files", "files"),
]

origins = allowed_origins()
app = FastAPI(title="ForgeArc Python API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if origins == ["*"] else origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def pick_handler(path: str):
    for prefix, name in ROUTE_MAP:
        if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix):
            return HANDLERS[name]
    return auth_handler


@app.get("/health")
def health():
    result = auth_handler(
        {
            "httpMethod": "GET",
            "path": "/health",
            "headers": {},
            "queryStringParameters": None,
            "body": None,
            "isBase64Encoded": False,
        },
        None,
    )
    return Response(
        content=result.get("body") or "",
        status_code=result.get("statusCode", 200),
        headers=result.get("headers") or {"Content-Type": "application/json"},
        media_type="application/json",
    )


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
        "requestContext": {"requestId": request.headers.get("x-request-id")},
    }
    result = pick_handler(path)(event, None)
    return Response(
        content=result.get("body") or "",
        status_code=result.get("statusCode", 200),
        headers=result.get("headers") or {"Content-Type": "application/json"},
        media_type="application/json",
    )
