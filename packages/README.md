# packages/

Cross-cutting libraries for **frontends** and API contracts.

| Package | Role |
|---------|------|
| `contracts/` | Zod + shared types (MFE + OpenAPI clients) |
| `types/` | Optional TS entities (can merge into contracts) |
| `ui/` | Design system for Module Federation |
| `utils/` | GST, currency, validators (no AWS) |

**Stays in CloudArc `api/`:**

- `layers/shared/` — Lambda framework + Prisma
- `modules/*/` — sellable backend SKUs
- `cdk/` — infrastructure
