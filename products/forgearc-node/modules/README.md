# ForgeArc modules

Sellable SKUs for the Node kit:

| SKU | Package | CSR | Description |
|-----|---------|-----|-------------|
| `platform` | `@forgearc/module-platform` | Controller → Service → Repository | Auth, users, roles, permissions, `/health` (required) |
| `demo` | `@forgearc/module-demo` | Controller → Service → Repository | Tutorial CRUD (paginated list) |
| `ai` | `@forgearc/module-ai` | Controller → Service | Chat / providers |
| `files` | `@forgearc/module-files` | Controller → Service | S3 presign upload/download |

Catalog: [`../scripts/modules-catalog.ts`](../scripts/modules-catalog.ts). Pattern: [docs/CSR-AND-DI.md](../../docs/CSR-AND-DI.md). Copy **demo** when adding a new module.
