# Controller → Service → Repository and dependency injection

Python uses the **same architecture as the Node kit**. If you know Inversify + CSR there, this is the Python spelling of the same ideas.

Canonical examples in this kit: `modules/demo` (full CSR), `modules/platform` (auth + users/roles/permissions), `modules/ai` and `modules/files` (Controller → Service).

Related:

- Lifecycle of the container: [packages/shared/DI.md](../packages/shared/DI.md)
- Node equivalent: `forgearc-node/packages/shared/DI.md` and Inversify in `defineLambda`

## Request flow

```text
API Gateway / FastAPI
        ↓
Lambda handler (cached router)
        ↓
Router (match method + path)
        ↓
Controller     HTTP, auth decorators, map request → service
        ↓
Service        business rules
        ↓
Repository     SQLModel / SQLAlchemy only
        ↓
Session factory (`SESSION_FACTORY` → `database.get_session`)
```

| Layer | Owns | Must not |
|-------|------|----------|
| Controller | Routes, `@ApiPublic` / `@RequirePermission` / `@RequireModule`, `@ApiBody`, HTTP status envelope | SQL, password hashing, token internals |
| Service | Validation rules, orchestration, mapping | HTTP objects, raw SQL |
| Repository | Queries and persistence | JWT, permission checks, HTTP |

AI has no database table, so it is **Controller → Service** (providers live behind the service). That matches “keep HTTP out of business logic,” even without a repository.

## Node ↔ Python cheat sheet

| Node | Python |
|------|--------|
| `@injectable()` | `@injectable` |
| `constructor(@inject(TYPES.Foo) private foo: IFoo)` | `def __init__(self, foo: IFoo = Inject(TYPES.Foo))` |
| `export const TYPES = { Foo: Symbol.for('Foo') }` | `class TYPES: Foo = "Foo"` |
| `defineLambda({ name, controllers, bindings })` | `define_lambda(name=..., controllers=..., bindings=...)` |
| `{ symbol: TYPES.Foo, implementation: Foo }` | `{"symbol": TYPES.Foo, "implementation": Foo}` |
| Inversify `Container` | `core.di.Container` |
| SQLAlchemy session | `SESSION_FACTORY` → `database.get_session` |
| `resetHandlerState(name)` | `reset_handler_state(name)` |

Python cannot decorate a single constructor parameter the way TypeScript does. **`Inject(TYPES.X)` as the default argument is the equivalent of `@inject(TYPES.X)`.**

## Folder layout (per module)

```text
modules/<sku>/
  lambdas/<sku>.py          # define_lambda + handler
  src/
    types/svc_types.py      # TYPES symbols
    controllers/
    services/
    repositories/           # omit only if there is no persistence
    schemas/                # Pydantic request models (@ApiBody)
```

## Wiring a lambda

Session factory is bound automatically. You only register services and repositories.

```python
from core.service_registry import define_lambda
from core.handler_factory import create_lambda_handler
from modules.demo.src.controllers.demo_controller import DemoItemController
from modules.demo.src.services.demo_item_service import DemoItemService
from modules.demo.src.repositories.demo_item_repository import DemoItemRepository
from modules.demo.src.types.svc_types import TYPES

define_lambda(
    name="demo",
    controllers=[DemoItemController],
    bindings=[
        {"symbol": TYPES.DemoItemService, "implementation": DemoItemService},
        {"symbol": TYPES.DemoItemRepository, "implementation": DemoItemRepository},
    ],
)
handler = create_lambda_handler("demo")
```

Constructor injection:

```python
from core.di import Inject, injectable
from modules.demo.src.types.svc_types import TYPES

@injectable
class DemoItemController:
    def __init__(self, service: IDemoItemService = Inject(TYPES.DemoItemService)):
        self.service = service
```

```python
@injectable
class DemoItemService:
    def __init__(self, repo: IDemoItemRepository = Inject(TYPES.DemoItemRepository)):
        self.repo = repo
```

```python
@injectable
class DemoItemRepository:
    def __init__(self, get_session=Inject(TYPES.SessionFactory)):
        self._get_session = get_session
```

`TYPES.SessionFactory` must equal `"SessionFactory"` (see `core.di.SESSION_FACTORY`). The registry binds `get_session` to that symbol on every lambda.

## Adding a new HTTP route

1. Pydantic model in `src/schemas/` and `@ApiBody(MyModel)` on the controller method.
2. Thin method on the **controller** (auth decorators + `self.service...`).
3. Logic on the **service**.
4. SQL on the **repository** (new methods as needed).
5. If you add a **new class**, add a `TYPES` symbol and a `bindings` entry. Forgetting this raises `No DI binding for '...'`.
6. Rebuild artifacts so CDK and OpenAPI stay in sync:

```bash
cd apps/api
uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py
uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py
```

## Adding a new module

1. Copy `modules/demo` (not a controller-only module), or run `uv run --package forgearc-python-api python apps/api/scripts/scaffold_module.py <sku>` from the product root (kit: `pnpm scaffold:module -- <sku>`).
2. Add the SKU to `apps/api/scripts/modules_catalog.py` if the scaffold did not.
3. Register the lambda in `src/dev_server.py` (`import` + `HANDLERS` + `ROUTE_MAP`).
4. Seed permission codes in `scripts/seed_admin.py` if the module needs them.
5. Run the two generate scripts above.

## Runtime extras (parity with Node)

- **Body validation:** `@ApiBody(PydanticModel)` is validated in the router (`core/validation.py`) before the controller runs.
- **Health:** public `GET /health` on the auth lambda (`HealthController`).
- **Request id:** `X-Request-Id` on every response (`core/request_context.py`).
- **CORS:** `ALLOWED_ORIGINS` (comma-separated; `*` by default).
- **Pagination:** `parse_list_query` / `pagination_meta` on demo and RBAC list endpoints.
- **Files SKU:** `POST /api/files/presign` and `/download` (Controller → Service).
- **RBAC HTTP:** `/api/user`, `/api/role`, `/api/permission` (same paths as Node).

## Cold start

The DI container and router are created **once per Lambda instance**, then reused. Do not construct `Container` inside a request handler.

Tests that build containers should call `reset_handler_state(lambda_name)` when they need a clean slate.

## What not to do

- `get_session()` inside a controller (that belongs in a repository).
- Instantiating `FooService()` or `FooRepository()` with `()` in application code — let `define_lambda` bindings resolve them.
- Binding controllers in `bindings` — pass them in `controllers=`; the registry `resolve()`s them into `container.controllers`.
