# @arcforge/dev-server (stub)

Express-first local API for ArcForge Lambda services.

**Current implementation:** [`api/src/dev-server.ts`](../../api/src/dev-server.ts) — port `4000`, converts HTTP to API Gateway events and invokes the same handlers as production.

**Planned:** extract to this package and expose `pnpm dev:api` from the monorepo root.

SAM / `sam local` is optional for Lambda-parity checks only; daily development uses Express.
