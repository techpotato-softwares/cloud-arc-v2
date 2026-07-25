# CloudArc + initiation doc (implemented layout)

## Summary

| Layer | Choice |
|-------|--------|
| **Git** | Monorepo (pnpm + Turborepo) |
| **Backend package** | `api/` (CloudArc host) |
| **Sellable unit** | `api/modules/{sku}/` = `@solaros/module-{sku}` |
| **Shared framework** | `api/layers/shared/` → `@solaros/shared` |
| **Infra** | `cdk/` reads `api/app-manifest.json` |
| **Runtime microservices** | One Lambda (or ECS) per module; marketplace via `modules` in manifest |

Initiation doc `services/leads-service/` maps to **`api/modules/leads/`**, not a separate repo root folder.

## Deploy / sell separately

1. **Commercial:** `tenants.modules_enabled` in DB (initiation Ch.06)
2. **CI:** `pnpm turbo run build --filter=@solaros/module-leads...`
3. **CDK:** Use `app-manifest.json` → `modules[sku].lambdas` to deploy subset
4. **UI:** `apps/mfes/mfe-{name}` gated by same SKU

## Not monolithic

- **Monorepo:** yes (one git repo)
- **Monolithic runtime:** no (many Lambdas + ECS)
- **Monolithic npm package:** no (19 workspace module packages + host)

## Module catalog

Source of truth: [`api/scripts/modules-catalog.ts`](../api/scripts/modules-catalog.ts)
