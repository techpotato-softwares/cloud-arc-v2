# @forgearc/module-platform

**Required** sellable base module — authentication and RBAC.

| | |
|---|---|
| **SKU** | `platform` |
| **Compute** | Lambda (`auth`, `user`, `role`, `permission`) |
| **MFE** | `mfe-settings` (users/roles config) |

## Deploy independently

```bash
# From repo root (Phase 1 CI)
pnpm --filter @forgearc/module-platform build
# CDK: deploy only platform lambdas via enabledModules context
```

Login, refresh, and `GET /health` stay public. Users/roles/permissions are JWT-gated.

Pattern: [docs/CSR-AND-DI.md](../../../docs/CSR-AND-DI.md).

