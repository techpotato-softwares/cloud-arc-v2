from decorators.registry import join_paths, route_registry


def test_join_paths():
    assert join_paths("/api/demo/items", "/") == "/api/demo/items"
    assert join_paths("/api", "/login") == "/api/login"
    assert join_paths("/api/demo/items", "/{id}") == "/api/demo/items/{id}"


def test_generate_manifest_groups_controllers():
    from modules.platform.src.controllers.auth_controller import AuthController
    from modules.demo.src.controllers.demo_controller import DemoItemController
    from modules.ai.src.controllers.ai_controller import AiController

    assert AuthController and DemoItemController and AiController
    manifest = route_registry.generate_manifest()
    assert "auth" in manifest["lambdas"]
    assert "demo" in manifest["lambdas"]
    assert "ai" in manifest["lambdas"]
    auth_paths = {(r["method"], r["path"]) for r in manifest["lambdas"]["auth"]["routes"]}
    assert ("POST", "/api/login") in auth_paths
    assert ("POST", "/api/auth/refresh") in auth_paths
    demo_paths = {(r["method"], r["path"]) for r in manifest["lambdas"]["demo"]["routes"]}
    assert ("GET", "/api/demo/items") in demo_paths
    assert ("GET", "/api/demo/items/{id}") in demo_paths


def test_openapi_includes_pydantic_body_schema():
    from modules.platform.src.controllers.auth_controller import AuthController  # noqa: F401
    from core.openapi import generate_from_route_registry

    doc = generate_from_route_registry()
    login = doc["paths"]["/api/login"]["post"]
    assert login["security"] == []
    assert "requestBody" in login
    ref = login["requestBody"]["content"]["application/json"]["schema"]["$ref"]
    assert "LoginRequest" in ref
    assert "LoginRequest" in doc["components"]["schemas"]
