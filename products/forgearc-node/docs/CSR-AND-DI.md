# Controller → Service → Repository and dependency injection

The Node kit uses **Inversify** with the same CSR split as Python.

Canonical examples: `modules/demo` (full CSR), `modules/platform` (auth + RBAC), `modules/ai` (Controller → Service), `modules/files` (Controller → Service).

Related:

- Container lifecycle: [packages/shared/DI.md](../packages/shared/DI.md)
- Python spelling: `forgearc-python/docs/CSR-AND-DI.md` (`Inject(TYPES.X)` instead of `@inject`)

## Request flow

```text
API Gateway / Express
        ↓
Lambda handler (cached router)
        ↓
Router (match method + path; Zod @ApiBody; JWT / permission / module)
        ↓
Controller     HTTP, auth decorators, map request → service
        ↓
Service        business rules
        ↓
Repository     Prisma only
        ↓
PrismaClient (bound automatically)
```

| Layer | Owns | Must not |
|-------|------|----------|
| Controller | Routes, `@ApiPublic` / `@RequirePermission` / `@RequireModule`, `@ApiBody`, HTTP envelope | SQL, password hashing, token internals |
| Service | Validation rules, orchestration, mapping | HTTP objects, raw SQL |
| Repository | Queries and persistence | JWT, permission checks, HTTP |

AI and files have no table, so they are **Controller → Service**.

## Wiring a lambda

Prisma is bound automatically. Register services and repositories only.

```typescript
defineLambda({
  name: 'demo',
  controllers: [DemoItemController],
  bindings: [
    { symbol: TYPES.DemoItemService, implementation: DemoItemService },
    { symbol: TYPES.DemoItemRepository, implementation: DemoItemRepository },
  ],
});
export const handler = createLambdaHandler('demo');
```

```typescript
@injectable()
export class DemoItemController {
  constructor(@inject(TYPES.DemoItemService) private service: IDemoItemService) {}
}
```

## Adding a new module

1. Copy `modules/demo` (or `pnpm scaffold:modules` where available).
2. Add the SKU to `apps/api/scripts/modules-catalog.ts`.
3. Import the lambda in `src/dev-server.ts`.
4. Seed any new permission codes (`scripts/seed-admin.js`).
5. `pnpm build:manifest && pnpm build:openapi`.

## Observability

- `GET /health` is public on the auth lambda.
- Every response sets `X-Request-Id`.
- CORS `Access-Control-Allow-Origin` uses `ALLOWED_ORIGINS`.
