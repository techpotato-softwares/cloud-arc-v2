"""Lightweight DI matching Node Inversify: symbols, bindings, constructor Inject()."""
from __future__ import annotations

import inspect
from dataclasses import dataclass
from typing import Any

# Same role as Node TYPES.PrismaClient — SQLAlchemy session factory (callable → Session)
SESSION_FACTORY = "SessionFactory"


class Inject:
    """Mark a constructor argument for the container.

    Node:  constructor(@inject(TYPES.Foo) private foo: IFoo)
    Python: def __init__(self, foo: IFoo = Inject(TYPES.Foo)):
    """

    __slots__ = ("symbol",)

    def __init__(self, symbol: str):
        self.symbol = symbol


def injectable(cls: type) -> type:
    """No-op marker matching Node @injectable()."""
    return cls


@dataclass
class ServiceBinding:
    symbol: str
    implementation: type
    scope: str = "singleton"


class Container:
    def __init__(self) -> None:
        self._constructors: dict[str, tuple[type, str]] = {}
        self._constants: dict[str, Any] = {}
        self._singletons: dict[str, Any] = {}
        self.controllers: dict[type, Any] = {}

    def bind(self, symbol: str, implementation: type, scope: str = "singleton") -> None:
        self._constructors[symbol] = (implementation, scope or "singleton")

    def bind_constant(self, symbol: str, value: Any) -> None:
        self._constants[symbol] = value

    def get(self, symbol: str) -> Any:
        if symbol in self._constants:
            return self._constants[symbol]
        if symbol in self._singletons:
            return self._singletons[symbol]
        if symbol not in self._constructors:
            raise KeyError(
                f"No DI binding for '{symbol}'. Register it in define_lambda(bindings=[...])."
            )
        implementation, scope = self._constructors[symbol]
        instance = self.resolve(implementation)
        if scope != "transient":
            self._singletons[symbol] = instance
        return instance

    def resolve(self, cls: type) -> Any:
        init = getattr(cls, "__init__", None)
        if init is None or init is object.__init__:
            return cls()
        try:
            sig = inspect.signature(init)
        except (TypeError, ValueError):
            return cls()
        kwargs: dict[str, Any] = {}
        for name, param in sig.parameters.items():
            if name == "self":
                continue
            if param.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD):
                continue
            default = param.default
            if isinstance(default, Inject):
                kwargs[name] = self.get(default.symbol)
            elif default is inspect.Parameter.empty:
                raise TypeError(
                    f"{cls.__name__}.__init__ parameter '{name}' needs "
                    f"Inject(TYPES....) or a default value"
                )
        return cls(**kwargs)
