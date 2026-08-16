from __future__ import annotations

import inspect
from typing import Any

from core.di import Container, SESSION_FACTORY, ServiceBinding
from utils.logger import logger


class LambdaRegistry:
    def __init__(self):
        self._defs: dict[str, dict[str, Any]] = {}
        self._containers: dict[str, Container] = {}

    def define(
        self,
        name: str,
        controllers: list[type],
        bindings: list | None = None,
        handler: str | None = None,
    ):
        self._defs[name] = {
            "name": name,
            "controllers": controllers,
            "bindings": bindings or [],
            "handler": handler,
        }

    def get_handler(self, name: str) -> str | None:
        definition = self._defs.get(name)
        if not definition:
            return None
        return definition.get("handler")

    def get_container(self, name: str) -> Container:
        cached = self._containers.get(name)
        if cached:
            return cached
        definition = self._defs.get(name)
        if not definition:
            raise RuntimeError(f"Lambda '{name}' not defined")
        container = self._create_container(definition)
        self._containers[name] = container
        return container

    def _create_container(self, definition: dict[str, Any]) -> Container:
        from database import get_session

        container = Container()
        container.bind_constant(SESSION_FACTORY, get_session)

        for raw in definition["bindings"]:
            binding = self._normalize_binding(raw)
            container.bind(binding.symbol, binding.implementation, binding.scope)

        for ctrl in definition["controllers"]:
            container.controllers[ctrl] = container.resolve(ctrl)

        logger.info(
            f"Initialized DI container for lambda '{definition.get('name', '')}' "
            f"({len(definition['controllers'])} controller(s), "
            f"{len(definition['bindings'])} binding(s))"
        )
        return container

    @staticmethod
    def _normalize_binding(raw: Any) -> ServiceBinding:
        if isinstance(raw, ServiceBinding):
            return raw
        if isinstance(raw, dict):
            return ServiceBinding(
                symbol=raw["symbol"],
                implementation=raw["implementation"],
                scope=raw.get("scope", "singleton"),
            )
        raise TypeError(f"Invalid service binding: {raw!r}")

    def reset_container(self, name: str) -> None:
        self._containers.pop(name, None)

    def clear(self) -> None:
        self._defs.clear()
        self._containers.clear()


lambda_registry = LambdaRegistry()


def define_lambda(*, name: str, controllers: list[type], bindings: list | None = None):
    """Register a lambda: controllers + CSR bindings (same shape as Node defineLambda)."""
    caller = inspect.currentframe()
    module_name = ""
    if caller and caller.f_back:
        module_name = caller.f_back.f_globals.get("__name__", "") or ""
    handler = f"{module_name}.handler" if module_name else None
    lambda_registry.define(name, controllers, bindings, handler=handler)
