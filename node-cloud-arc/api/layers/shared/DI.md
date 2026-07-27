# Dependency injection (Inversify) — module scope

ArcForge Lambda handlers use a **module-scoped DI container**, not a new container per invocation.

## Lifecycle

1. **Cold start:** `createLambdaHandler('auth')` runs `initializeLambda()` when the handler module loads.
2. **Container:** `lambdaRegistry.getContainer(lambdaName)` builds the Inversify container once and caches it in a `Map` keyed by lambda name.
3. **Router:** `createRouter(container, lambdaName)` is stored in `handlerStates` and reused on warm invocations.
4. **Warm requests:** `initializeLambda()` returns the cached router immediately; init timing is logged on first init only.

## Files

| File | Role |
|------|------|
| `src/core/handler-factory.ts` | Per-lambda `HandlerState` cache + cold-start prefetch |
| `src/core/service-registry.ts` | `lambdaRegistry` — container `Map`, bindings from `defineLambda()` |
| `src/core/router.ts` | Resolves controller from container per request |

## Operational notes

- **Do not** instantiate `Container` inside `handleRequest`.
- **Tests:** call `resetHandlerState(lambdaName)` or `clearAllHandlerStates()` between cases.
- **ECS/Fastify services (Phase 2):** use a separate bootstrap; share services/repos, not the API Gateway router.

See `handler-factory.ts` log line: `Lambda '<name>' initialized in <ms>ms`.
