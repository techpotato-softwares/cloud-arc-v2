"""Lightweight constructor injection, matching the ForgeArc Python kit."""

from __future__ import annotations

import inspect
from typing import Any


class Inject:
    __slots__ = ("symbol",)

    def __init__(self, symbol: str):
        self.symbol = symbol


def injectable(cls: type) -> type:
    return cls


class Container:
    def __init__(self) -> None:
        self._constructors: dict[str, type] = {}
        self._singletons: dict[str, Any] = {}
        self._constants: dict[str, Any] = {}

    def bind(self, symbol: str, implementation: type) -> None:
        self._constructors[symbol] = implementation

    def bind_constant(self, symbol: str, value: Any) -> None:
        self._constants[symbol] = value

    def get(self, symbol: str) -> Any:
        if symbol in self._constants:
            return self._constants[symbol]
        if symbol in self._singletons:
            return self._singletons[symbol]
        implementation = self._constructors[symbol]
        instance = self.resolve(implementation)
        self._singletons[symbol] = instance
        return instance

    def resolve(self, cls: type) -> Any:
        signature = inspect.signature(cls.__init__)
        kwargs = {}
        for name, param in signature.parameters.items():
            if name == "self":
                continue
            if isinstance(param.default, Inject):
                kwargs[name] = self.get(param.default.symbol)
        return cls(**kwargs)
