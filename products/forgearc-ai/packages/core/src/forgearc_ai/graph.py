"""A small state graph with the same node and edge shape as LangGraph.

Nodes take the state dict and return a partial update. Routers take the state and
return the next node name or END. The built-in runner has no dependencies;
`compile_langgraph` builds the same graph on LangGraph when the extra is installed.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from forgearc_ai.errors import ConfigError, PolicyError

END = "__end__"

Node = Callable[[dict], dict]
Router = Callable[[dict], str]


def _merge(current: dict, update: dict) -> dict:
    return {**current, **update}


class StateGraph:
    def __init__(self, name: str, max_transitions: int = 32):
        self.name = name
        self.max_transitions = max_transitions
        self.nodes: dict[str, Node] = {}
        self.routers: dict[str, Router] = {}
        self.entry: Router | None = None

    def add_node(self, name: str, node: Node) -> None:
        self.nodes[name] = node

    def add_edge(self, source: str, target: str) -> None:
        self.routers[source] = lambda _state: target

    def add_conditional_edges(self, source: str, router: Router) -> None:
        self.routers[source] = router

    def set_entry(self, router: Router) -> None:
        self.entry = router

    def invoke(self, state: dict) -> dict:
        if self.entry is None:
            raise ConfigError(f"Graph {self.name} has no entry point.")
        current = self.entry(state)
        for _ in range(self.max_transitions):
            if current == END:
                return state
            state.update(self.nodes[current](state) or {})
            state.setdefault("trace", []).append(current)
            current = self.routers.get(current, lambda _state: END)(state)
        raise PolicyError(f"Graph {self.name} exceeded {self.max_transitions} transitions.")

    def compile_langgraph(self):
        try:
            from langgraph.graph import END as LG_END
            from langgraph.graph import START as LG_START
            from langgraph.graph import StateGraph as LangGraphStateGraph
        except ImportError as exc:
            raise ConfigError("Install the langgraph extra to compile this graph with LangGraph.") from exc
        if self.entry is None:
            raise ConfigError(f"Graph {self.name} has no entry point.")

        def translate(router: Router) -> Router:
            return lambda state: LG_END if router(state) == END else router(state)

        graph = LangGraphStateGraph(Annotated[dict, _merge])
        for name, node in self.nodes.items():
            graph.add_node(name, node)
            router = self.routers.get(name)
            if router is None:
                graph.add_edge(name, LG_END)
            else:
                graph.add_conditional_edges(name, translate(router))
        graph.add_conditional_edges(LG_START, translate(self.entry))
        return graph.compile()
