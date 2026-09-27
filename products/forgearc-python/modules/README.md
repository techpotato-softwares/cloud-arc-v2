# ForgeArc modules (Python)

Sellable SKUs — same catalog idea as the Node kit:

| SKU | Package | CSR | Description |
|-----|---------|-----|-------------|
| `platform` | `forgearc-module-platform` | Controller → Service → Repository | Auth, users, roles, permissions, `/health` (required) |
| `demo` | `forgearc-module-demo` | Controller → Service → Repository | Tutorial CRUD (paginated list) |
| `ai` | `forgearc-module-ai` | Controller → Service | Chat / providers |
| `files` | `forgearc-module-files` | Controller → Service | S3 presign upload/download |

Catalog: [`../scripts/modules_catalog.py`](../scripts/modules_catalog.py).

Pattern reference: [docs/CSR-AND-DI.md](../../docs/CSR-AND-DI.md). Copy **demo** (or `uv run --package forgearc-python-api python apps/api/scripts/scaffold_module.py <sku>`) when adding a new module.
