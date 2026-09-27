# ForgeArc Files Module

Presigned S3 upload/download.

| | |
|---|---|
| **SKU** | `files` |
| **Compute** | Lambda (`files`) |
| **CSR** | `FilesController` → `FilesService` |
| **Requires** | platform; tenant `modulesEnabled` includes `files` |

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/files/presign` | `files:write` |
| POST | `/api/files/download` | `files:read` |

Set `S3_BUCKET_NAME`. Pattern: [docs/CSR-AND-DI.md](../../../docs/CSR-AND-DI.md).
