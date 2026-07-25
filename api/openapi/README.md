# ArcForge OpenAPI

Generated at build time from Zod schemas and `@ApiBody` / route metadata on controllers.

```bash
cd api && npm run build:openapi
```

Outputs:

- `openapi.yaml` — OpenAPI 3.1 (commit for MFE client generation)
- `openapi.json` — same document as JSON

Source: `layers/shared/nodejs/src/core/openapi/` + platform RBAC Zod in `modules/platform/src/schemas/zod/`.
