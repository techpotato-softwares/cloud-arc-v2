# Dependency injection — module scope

ArcForge Python Lambda handlers use a **module-scoped DI container**, not a new container per invocation.

This matches the Node kit (`node-cloud-arc/api/layers/shared/DI.md`). How to write Controller / Service / Repository classes: [docs/CSR-AND-DI.md](../../../docs/CSR-AND-DI.md).

## Lifecycle

1. **Cold start:** `create_lambda_handler("auth")` runs on the first request (handler module already called `define_lambda`).
2. **Container:** `lambda_registry.get_container(lambda_name)` builds `core.di.Container` once and caches it by lambda name.
3. **Bindings:** session factory (`SESSION_FACTORY` → `get_session`) plus each `{ symbol, implementation }` from `define_lambda`.
4. **Router:** `create_router(container, lambda_name)` is stored on handler state and reused on warm invocations.
5. **Warm requests:** the cached router is used immediately; controllers are already constructed.

## Files

| File | Role |
|------|------|
| `src/core/di.py` | `Container`, `Inject`, `injectable`, `SESSION_FACTORY` |
| `src/core/service_registry.py` | `define_lambda` / `lambda_registry` — cache + bindings |
| `src/core/handler_factory.py` | Per-lambda router cache |
| `src/core/router.py` | `container.controllers[ControllerClass]` per request |

## Operational notes

- **Do not** instantiate `Container` inside `handle_request`.
- **Tests:** call `reset_handler_state(lambda_name)` between cases that need a fresh container.
- Missing a `bindings` entry shows as `No DI binding for '...'`.
