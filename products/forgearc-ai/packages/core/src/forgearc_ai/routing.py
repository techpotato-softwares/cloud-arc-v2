from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class RouteSpec:
    method: str
    path: str
    handler_name: str
    auth: bool = True
    module: str | None = "ai"
    permission: str | None = None
    stream: bool = False
    multipart: bool = False
    kind: str = "json"


class RouteRegistry:
    def __init__(self) -> None:
        self.controllers: list[type] = []
        self.routes: list[tuple[type, RouteSpec]] = []

    def add(self, cls: type, spec: RouteSpec) -> None:
        if any(existing.method == spec.method and existing.path == spec.path for _, existing in self.routes):
            return
        if cls not in self.controllers:
            self.controllers.append(cls)
        self.routes.append((cls, spec))

    def clear(self) -> None:
        self.controllers.clear()
        self.routes.clear()

    def manifest(self) -> dict[str, Any]:
        grouped: dict[str, list[dict[str, str]]] = {}
        for cls, spec in self.routes:
            lambda_name = "api"
            grouped.setdefault(lambda_name, []).append(
                {
                    "method": spec.method,
                    "path": spec.path,
                    "controller": cls.__name__,
                    "action": spec.handler_name,
                }
            )
        return {
            "version": "1.0",
            "runtime": "python",
            "product": "forgearc-ai",
            "lambdas": {
                "api": {"handler": "forgearc_ai_api.worker.api_handler", "routes": grouped.get("api", [])},
                "ingest": {"handler": "forgearc_ai_api.worker.handler", "routes": []},
            },
        }


route_registry = RouteRegistry()


def _route(method: str, path: str, **flags: Any) -> Callable:
    def deco(fn):
        fn.__route__ = RouteSpec(method=method, path=path, handler_name=fn.__name__, **flags)
        return fn

    return deco


def Get(path: str, **flags: Any):
    return _route("GET", path, kind="get", **flags)


def Post(path: str, **flags: Any):
    return _route("POST", path, **flags)


def Delete(path: str, **flags: Any):
    return _route("DELETE", path, kind="get", **flags)


def Controller(cls: type) -> type:
    for attr in cls.__dict__.values():
        spec = getattr(attr, "__route__", None)
        if spec is not None:
            route_registry.add(cls, spec)
    return cls
