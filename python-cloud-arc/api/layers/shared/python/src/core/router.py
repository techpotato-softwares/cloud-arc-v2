from __future__ import annotations
import re
import uuid
from typing import Any

from core.di import Container
from core.request_context import request_id_var, request_origin_var
from core.validation import validate_route_input
from decorators.registry import route_registry
from middleware.auth import auth_middleware
from middleware.error_handler import (
    create_success_response, create_error_response, handle_options,
    ValidationError, ForbiddenError,
)
from core.parameter_resolver import resolve_parameters
from utils.logger import logger

PUBLIC = {("POST", "/api/login"), ("POST", "/api/auth/refresh"), ("GET", "/health")}


def _header(event: dict, name: str) -> str | None:
    headers = event.get("headers") or {}
    lower = {str(k).lower(): v for k, v in headers.items()}
    return lower.get(name.lower())


class Router:
    def __init__(self, container: Container, lambda_name: str):
        self.container = container
        self.lambda_name = lambda_name

    def _normalize(self, path: str) -> str:
        return path.rstrip("/") if path != "/" else path

    def _match(self, method: str, path: str):
        path = self._normalize(path)
        for route in route_registry.get_routes(self.lambda_name):
            base = route.get("base_path", "").rstrip("/")
            route_path = route["path"] if route["path"].startswith("/") else "/" + route["path"]
            full = self._normalize(base + ("" if route_path == "/" else route_path))
            pattern = re.sub(r"\{([^}]+)\}", r"(?P<\1>[^/]+)", full)
            pattern = f"^{pattern}$"
            if route["method"] != method:
                continue
            m = re.match(pattern, path)
            if m:
                return route, m.groupdict()
        return None, {}

    def handle_request(self, event: dict, context: Any = None) -> dict:
        rid = _header(event, "x-request-id") or getattr(context, "aws_request_id", None) or str(uuid.uuid4())
        request_id_var.set(rid)
        request_origin_var.set(_header(event, "origin"))
        logger.set_context(requestId=rid, lambdaName=self.lambda_name)
        method = (event.get("httpMethod") or "GET").upper()
        path = event.get("path") or "/"
        if method == "OPTIONS":
            return handle_options()
        try:
            route, path_params = self._match(method, path)
            if not route:
                raise ValidationError(f"No route found for {method} {path}")
            public = route.get("public") or (method, self._normalize(path)) in PUBLIC
            if not public:
                auth_result = auth_middleware(event)
                if "statusCode" in auth_result and "body" in auth_result and "user" not in auth_result:
                    return auth_result
                event = auth_result
                user = event.get("user") or {}
                required = route.get("permissions")
                if required:
                    owned = set(user.get("permissions") or [])
                    if not any(c in owned for c in required):
                        raise ForbiddenError(f"Missing required permission: {' | '.join(required)}")
                sku = route.get("required_module")
                if sku:
                    enabled = user.get("modulesEnabled") or ["platform", "demo"]
                    if sku not in enabled:
                        raise ForbiddenError(f"Module '{sku}' is not enabled for this tenant")
            validate_route_input(route, event)
            ctrl = self.container.controllers[route["controller"]]
            fn = getattr(ctrl, route["method_name"])
            args = resolve_parameters(fn, event, path_params)
            result = fn(*args)
            if isinstance(result, dict) and "statusCode" in result:
                return result
            return create_success_response(result)
        except Exception as e:
            logger.error("Request failed", {"error": str(e)})
            return create_error_response(e)
        finally:
            logger.clear_context()


def create_router(container: Container, lambda_name: str) -> Router:
    return Router(container, lambda_name)
