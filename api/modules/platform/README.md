# @arcforge/module-platform

**Required** sellable base module — authentication and RBAC.

| | |
|---|---|
| **SKU** | `platform` |
| **Compute** | Lambda (`auth`, `user`, `role`, `permission`) |
| **MFE** | `mfe-settings` (users/roles config) |

## Deploy independently

```bash
# From repo root (Phase 1 CI)
pnpm --filter @arcforge/module-platform build
# CDK: deploy only platform lambdas via enabledModules context
```

Other modules declare `"requiredModules": ["platform"]` in `module.manifest.json`.
