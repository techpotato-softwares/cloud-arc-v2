# Python architecture

<ArchitectureMap title="ForgeArc Python" preset="python-aws" />

## Processes

| Process | Where | Role |
| --- | --- | --- |
| FastAPI | `apps/api/src/dev_server.py`, port 4001 | Builds an API Gateway event and calls the module handler |
| Module Lambda | `modules/<sku>/lambdas/<name>.py` | `define_lambda(...)` then `handler = create_lambda_handler(name)` |
| Shared layer | `packages/shared/src` | Router, DI, SQLAlchemy session, JWT, errors, OpenAPI |
| Alembic | `migrations/` | Schema revisions |
| CDK | `infra/cdk/` in Python | Reads the manifest and builds the stack |

`dev_server.py` keeps a prefix map (`/api/demo` → demo handler, `/api/ai` → AI handler, and so on). A new module is invisible locally until that map includes it.

## Inside a request

<Mermaid chart="flowchart TB
  edge[FastAPI or API Gateway] --> factory[create_lambda_handler]
  factory --> container[Container built once per cold start]
  container --> router[Router]
  router --> jwt[JWT unless ApiPublic]
  jwt --> gates[RequirePermission and RequireModule]
  gates --> pydantic[Pydantic ApiBody]
  pydantic --> controller[Controller]
  controller --> service[Service]
  service --> repo[Repository]
  repo --> session[SESSION_FACTORY get_session]
  session --> pg[(PostgreSQL)]" />

`SESSION_FACTORY` is the string `"SessionFactory"`. Every Lambda binds `database.get_session` to it. Repositories take that callable with `Inject(TYPES.SessionFactory)` and open a session per operation.

## Injection

```python
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

```python
@injectable
class DemoItemController:
    def __init__(self, service: IDemoItemService = Inject(TYPES.DemoItemService)):
        self.service = service
```

The container reads `Inject(...)` defaults because Python cannot decorate a single parameter the way TypeScript does. Controllers stay free of SQL. Repositories stay free of JWT checks.

## Data

Models live in `packages/shared/src/database/models.py`: users, roles, permissions, tenants, and demo items. Tenant rows store `modules_enabled` as JSON. Login copies that list onto the token.

Alembic's first revision creates the metadata. Later changes should be new revisions, not edits to a revision that has already run.

## Deploy shape

`uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py` imports the module Lambdas, reads the decorator registry, and writes `apps/api/app-manifest.json`. `generate_openapi.py` writes `apps/api/openapi/openapi.yaml` from the Pydantic models. CDK's `LambdaConstruct` and `ApiGatewayConstruct` consume the manifest only.

See [Deploy](/architecture/deploy).
