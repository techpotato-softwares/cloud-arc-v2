from __future__ import annotations

import json
import re
from typing import Any

from decorators.registry import join_paths, route_registry
from pydantic import BaseModel

from core.openapi.envelope import ApiEnvelope, ApiError

METHOD_MAP = {
    "GET": "get",
    "POST": "post",
    "PUT": "put",
    "DELETE": "delete",
    "PATCH": "patch",
}


def _register_model(model: type[BaseModel], components: dict[str, Any]) -> dict[str, str]:
    schema = model.model_json_schema(ref_template="#/components/schemas/{model}")
    defs = schema.pop("$defs", {}) or {}
    components.setdefault("schemas", {}).update(defs)
    name = schema.get("title") or model.__name__
    components["schemas"][name] = schema
    return {"$ref": f"#/components/schemas/{name}"}


def _path_parameters(path: str) -> list[dict[str, Any]]:
    return [
        {
            "name": name,
            "in": "path",
            "required": True,
            "schema": {"type": "string"},
        }
        for name in re.findall(r"\{([^}]+)\}", path)
    ]


def _default_responses(
    route: dict[str, Any], components: dict[str, Any]
) -> dict[str, Any]:
    error_ref = _register_model(ApiError, components)
    envelope_ref = _register_model(ApiEnvelope, components)
    mapped: dict[str, Any] = {
        "400": {
            "description": "Validation error",
            "content": {"application/json": {"schema": error_ref}},
        },
        "401": {"description": "Unauthorized"},
        "403": {"description": "Forbidden"},
    }
    responses = route.get("responses")
    if responses:
        for status, schema in responses.items():
            mapped[str(status)] = {
                "description": f"Response {status}",
                "content": {"application/json": {"schema": _register_model(schema, components)}},
            }
    else:
        mapped["200"] = {
            "description": "Success",
            "content": {"application/json": {"schema": envelope_ref}},
        }
    return mapped


def generate_from_route_registry(
    *,
    title: str = "ForgeArc API",
    version: str = "0.1.0",
    description: str | None = None,
    servers: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    components: dict[str, Any] = {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        },
        "schemas": {},
    }
    _register_model(ApiEnvelope, components)
    _register_model(ApiError, components)

    paths: dict[str, Any] = {}
    for cls in route_registry.all_controllers():
        meta = getattr(cls, "__controller_meta__", {}) or {}
        controller_name = cls.__name__
        base_path = meta.get("path", "")
        default_tag = controller_name.replace("Controller", "")
        for route in getattr(cls, "__routes__", []):
            method = METHOD_MAP.get(str(route.get("method", "")).upper())
            if not method:
                continue
            full_path = join_paths(base_path, route.get("path", "/"))
            openapi_meta = route.get("openapi") or {}
            is_public = route.get("public") is True or openapi_meta.get("public") is True
            operation: dict[str, Any] = {
                "tags": openapi_meta.get("tags") or [default_tag],
                "operationId": openapi_meta.get("operationId")
                or f"{controller_name}.{route.get('method_name')}",
                "security": [] if is_public else [{"bearerAuth": []}],
                "parameters": _path_parameters(full_path),
                "responses": _default_responses(route, components),
            }
            if openapi_meta.get("summary"):
                operation["summary"] = openapi_meta["summary"]
            body_schema = route.get("body_schema")
            if body_schema:
                operation["requestBody"] = {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": _register_model(body_schema, components),
                        }
                    },
                }
            query_schema = route.get("query_schema")
            if query_schema:
                q_schema = query_schema.model_json_schema()
                for name, prop in (q_schema.get("properties") or {}).items():
                    operation["parameters"].append(
                        {
                            "name": name,
                            "in": "query",
                            "required": name in (q_schema.get("required") or []),
                            "schema": prop,
                        }
                    )
            paths.setdefault(full_path, {})[method] = operation

    return {
        "openapi": "3.1.0",
        "info": {
            "title": title,
            "version": version,
            **({"description": description} if description else {}),
        },
        "servers": servers
        or [{"url": "http://localhost:4001", "description": "FastAPI dev server"}],
        "paths": paths,
        "components": components,
    }


def generate_openapi_json(**kwargs: Any) -> str:
    return json.dumps(generate_from_route_registry(**kwargs), indent=2)


def generate_openapi_yaml(**kwargs: Any) -> str:
    import yaml

    return yaml.dump(
        generate_from_route_registry(**kwargs),
        sort_keys=False,
        allow_unicode=True,
    )
