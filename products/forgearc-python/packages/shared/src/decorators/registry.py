from __future__ import annotations

from datetime import UTC, datetime
from typing import Any


def join_paths(base_path: str, route_path: str) -> str:
    base = base_path.rstrip("/") if base_path != "/" else base_path
    route = route_path if route_path.startswith("/") else f"/{route_path}"
    if route == "/":
        return base or "/"
    return f"{base}{route}" or "/"


class RouteRegistry:
    def __init__(self):
        self._controllers: list[type] = []
        self._routes: list[dict[str, Any]] = []

    def register_controller(self, cls: type):
        if cls not in self._controllers:
            self._controllers.append(cls)
            for route in getattr(cls, "__routes__", []):
                self._routes.append({**route, "controller": cls})

    def get_routes(self, lambda_name: str | None = None) -> list[dict[str, Any]]:
        routes = []
        for cls in self._controllers:
            meta = getattr(cls, "__controller_meta__", {})
            if lambda_name and meta.get("lambda_name") and meta["lambda_name"] != lambda_name:
                continue
            for route in getattr(cls, "__routes__", []):
                routes.append({**route, "controller": cls, "base_path": meta.get("path", "")})
        return routes

    def all_controllers(self) -> list[type]:
        return list(self._controllers)

    def clear(self) -> None:
        self._controllers.clear()
        self._routes.clear()

    def generate_manifest(self, *, handler_map: dict[str, str] | None = None) -> dict[str, Any]:
        """Build app-manifest.json payload from registered controllers (CDK input)."""
        from core.service_registry import lambda_registry

        handler_map = handler_map or {}
        groups: dict[str, dict[str, Any]] = {}

        for cls in self._controllers:
            meta = getattr(cls, "__controller_meta__", {}) or {}
            controller_name = cls.__name__
            lambda_name = meta.get("lambda_name") or controller_name.lower().replace("controller", "")
            base_path = meta.get("path", "")
            entries = [
                {
                    "method": route["method"],
                    "path": join_paths(base_path, route.get("path", "/")),
                    "controller": controller_name,
                    "action": route.get("method_name") or route.get("handler"),
                }
                for route in getattr(cls, "__routes__", [])
            ]
            if lambda_name not in groups:
                groups[lambda_name] = {"controllers": [], "routes": []}
            groups[lambda_name]["controllers"].append(controller_name)
            groups[lambda_name]["routes"].extend(entries)

        lambdas: dict[str, Any] = {}
        for lambda_name, group in groups.items():
            handler = (
                handler_map.get(lambda_name)
                or lambda_registry.get_handler(lambda_name)
                or f"{lambda_name}.handler"
            )
            lambdas[lambda_name] = {
                "handler": handler,
                "controller": ", ".join(group["controllers"]),
                "routes": group["routes"],
            }

        return {
            "version": "2.0",
            "runtime": "python",
            "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "lambdas": lambdas,
        }


route_registry = RouteRegistry()
