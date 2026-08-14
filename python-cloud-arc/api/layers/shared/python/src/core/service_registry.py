from __future__ import annotations
import inspect
from typing import Any
from utils.logger import logger

class LambdaRegistry:
    def __init__(self):
        self._defs: dict[str, dict[str, Any]] = {}
        self._containers: dict[str, dict[str, Any]] = {}

    def define(
        self,
        name: str,
        controllers: list[type],
        bindings: list[dict] | None = None,
        handler: str | None = None,
    ):
        self._defs[name] = {
            "controllers": controllers,
            "bindings": bindings or [],
            "handler": handler,
        }

    def get_handler(self, name: str) -> str | None:
        definition = self._defs.get(name)
        if not definition:
            return None
        return definition.get("handler")

    def get_container(self, name: str) -> dict[str, Any]:
        if name in self._containers:
            return self._containers[name]
        definition = self._defs.get(name)
        if not definition:
            raise RuntimeError(f"Lambda '{name}' not defined")
        container: dict[str, Any] = {"controllers": {}}
        # instantiate controllers with no-arg or simple DI later
        for ctrl in definition["controllers"]:
            container["controllers"][ctrl] = ctrl()
        self._containers[name] = container
        logger.info(f"Initialized container for lambda '{name}'")
        return container

lambda_registry = LambdaRegistry()

def define_lambda(*, name: str, controllers: list[type], bindings: list | None = None):
    caller = inspect.currentframe()
    module_name = ""
    if caller and caller.f_back:
        module_name = caller.f_back.f_globals.get("__name__", "") or ""
    handler = f"{module_name}.handler" if module_name else None
    lambda_registry.define(name, controllers, bindings, handler=handler)
