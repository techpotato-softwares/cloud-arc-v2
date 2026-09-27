# ForgeArc Platform Module (Python)

**Required** base module — authentication and RBAC HTTP APIs.

| | |
|---|---|
| **SKU** | `platform` |
| **Compute** | Lambda (`auth`, `user`, `role`, `permission`) |
| **CSR** | Controller → Service → Repository for each |

Login and refresh stay public (`@ApiPublic`). `GET /health` is public on the auth lambda.

| Lambda | Paths |
|--------|--------|
| `auth` | `POST /api/login`, `POST /api/auth/refresh`, `GET /health` |
| `user` | `/api/user` |
| `role` | `/api/role` |
| `permission` | `/api/permission` |

Bindings live under `lambdas/`. Pattern: [docs/CSR-AND-DI.md](../../../docs/CSR-AND-DI.md).
