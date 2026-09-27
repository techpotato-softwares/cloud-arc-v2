# Request path

A request does not branch into a different design when it leaves your laptop. The local server builds an API Gateway event and calls the same handler the Lambda will call in AWS.

<ArchitectureMap title="One handler, two front doors" preset="python-aws" />

## Step by step

1. **Edge.** Locally this is Express (Node, port 4000) or FastAPI (Python, port 4001). In AWS it is API Gateway. Both pass method, path, headers, query, and body through.
2. **Lambda entry.** Each module has a handler, for example `modules.demo.lambdas.demo.handler`. The handler factory builds the dependency container once per cold start and caches the router.
3. **Route match.** The router looks up method and path from the decorator registry. `{id}` segments become path parameters.
4. **Public or authenticated.** `GET /health`, `POST /api/login`, and `POST /api/auth/refresh` skip JWT. Everything else requires a Bearer access token.
5. **Permission and module.** `@RequirePermission("demo:write", "admin")` passes if the token contains any one of those codes. `@RequireModule("demo")` passes only if the tenant's `modulesEnabled` list contains `demo`.
6. **Body validation.** Node uses Zod. Python uses a Pydantic model marked with `@ApiBody`. Invalid bodies never reach the controller.
7. **Controller, service, repository.** The controller reads the validated body and the user from the token. The service applies rules. The repository talks to the database.
8. **Envelope.** Success is `{ "success": true, "data": ... }`. Failure is `{ "success": false, "error": { "code", "message" } }`. Every response sets `X-Request-Id`.

<Mermaid chart="sequenceDiagram
  participant Client
  participant Edge as Express_or_FastAPI_or_API_Gateway
  participant Handler as Lambda_handler
  participant Router
  participant Service
  participant DB as PostgreSQL
  Client->>Edge: POST /api/demo/items
  Edge->>Handler: API Gateway event
  Handler->>Router: match route
  Router->>Router: verify JWT and demo:write
  Router->>Service: create item
  Service->>DB: insert row for tenant
  DB-->>Client: 200 success envelope" />

## Login, then a protected call

<Mermaid chart="sequenceDiagram
  participant Client
  participant Auth as auth_lambda
  participant API as demo_lambda
  Client->>Auth: POST /api/login
  Auth-->>Client: accessToken and refreshToken
  Client->>API: GET /api/demo/items Authorization Bearer
  API-->>Client: page of items" />

`POST /api/auth/refresh` takes `{ "refreshToken" }` and returns a new access token. Access tokens carry `permissions`, `modulesEnabled`, and `tenantId`.

## List responses

List routes add paging inside `data`:

```json
{
  "success": true,
  "data": {
    "data": [],
    "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
  }
}
```

Query parameters are `page` and `limit`. Some role and permission lists also accept `searchKey` and `searchTerm`.

## Where this lives

| Concern | Node | Python |
| --- | --- | --- |
| Local server | `apps/api/src/dev-server.ts` | `apps/api/src/dev_server.py` |
| Handler cache | shared `core/` | `core/handler_factory.py` |
| Router | shared `core/router.ts` | `core/router.py` |
| JWT | shared middleware | `middleware/auth.py` |
| Injection | Inversify `defineLambda` | `define_lambda` in `core/service_registry.py` |
