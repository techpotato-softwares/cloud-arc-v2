# ArcForge modules (Python)

Sellable SKUs — same catalog idea as the Node kit:

| SKU | Package | CSR | Description |
|-----|---------|-----|-------------|
| `platform` | `arcforge-module-platform` | Controller → Service → Repository | Auth, users, roles, permissions, `/health` (required) |
| `demo` | `arcforge-module-demo` | Controller → Service → Repository | Tutorial CRUD (paginated list) |
| `ai` | `arcforge-module-ai` | Controller → Service | Chat / providers |
| `files` | `arcforge-module-files` | Controller → Service | S3 presign upload/download |

Catalog: [`../scripts/modules_catalog.py`](../scripts/modules_catalog.py).

Pattern reference: [docs/CSR-AND-DI.md](../../docs/CSR-AND-DI.md). Copy **demo** (or `python scripts/scaffold_module.py <sku>`) when adding a new module.
