# Modules

A module is a sellable slice of the API. It has its own Lambda (or several, for platform), its own routes, and its own permission codes. The shared layer does not contain product routes.

```text
modules/<sku>/
  lambdas/<name>.py          # or <name>.lambda.ts
  src/controllers/
  src/services/
  src/repositories/          # omitted only when there is no database
  src/schemas/
  src/types/
```

## Platform — required

Authentication and access control. Login and health are public. Creating a user is not public.

| Lambda | Routes | Who can call |
| --- | --- | --- |
| `auth` | `POST /api/login`, `POST /api/auth/refresh`, `GET /health` | Public |
| `user` | `GET/POST /api/user`, `GET/PUT/DELETE /api/user/{id}` | `user:read`, `user:write`, or `user:create` |
| `role` | `/api/role` and `/api/role/{id}` | role permissions |
| `permission` | `/api/permission` and `/api/permission/{id}` | permission permissions |

`GET /health` returns `{ "status": "ok", "product": "..." }` inside the success envelope. It is attached to the auth Lambda so API Gateway has a liveness route without a separate function.

Passwords are hashed with bcrypt. The access token is a JWT. In AWS the signing secret comes from Secrets Manager (`JWT_SECRET_ID`). Locally it comes from the environment.

## Demo — the pattern to copy

Full controller, service, and repository. Routes live under `/api/demo/items`.

| Method | Path | Permission | Module flag |
| --- | --- | --- | --- |
| GET | `/api/demo/items` | `demo:read` or `admin` | `demo` |
| POST | `/api/demo/items` | `demo:write` or `admin` | `demo` |
| GET, PUT, DELETE | `/api/demo/items/{id}` | read or write, as above | `demo` |

Create body: `{ "title": string, "description"?: string, "status"?: string }`.

The list is paginated. Rows are scoped to the tenant on the token. This is the module to copy when you add your own table.

## Files

No database table. The service asks S3 for a presigned URL.

| Method | Path | Body | Permission |
| --- | --- | --- | --- |
| POST | `/api/files/presign` | `{ "fileName", "contentType"? }` | `files:write` |
| POST | `/api/files/download` | `{ "s3Key" }` | `files:read` |

The Lambda needs `S3_BUCKET_NAME`. CDK adds that when the S3 feature flag is on. Dev defaults turn S3 on and RDS off, so file routes can be deployed against an existing database.

<Mermaid chart="sequenceDiagram
  participant Client
  participant API as files_lambda
  participant S3
  Client->>API: POST /api/files/presign
  API->>S3: create presigned PUT
  API-->>Client: url and key
  Client->>S3: PUT file bytes
  Client->>API: POST /api/files/download
  API-->>Client: presigned GET" />

## AI stub

`POST /api/ai/chat` with `{ "message": string }`. It requires `ai:chat` or `admin`, and the tenant module `ai`.

The provider is chosen with `AI_PROVIDER=stub|openai|bedrock`. The current kit returns a stub reply. It does not call OpenAI or Bedrock yet. A missing key falls back to the stub, so a green response is not proof of a live model. ForgeArc AI replaces this path.

## Adding a module

**Python**

1. `uv run --package forgearc-python-api python apps/api/scripts/scaffold_module.py <sku>`
2. Register it in `apps/api/scripts/modules_catalog.py` if the scaffold did not.
3. Add permissions in `apps/api/scripts/seed_admin.py`.
4. Point the local server at the new handler in `apps/api/src/dev_server.py`.
5. `uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py` and `uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py`.

**Node**

Use the Node kit's module scripts, then `pnpm build:manifest` and `pnpm build:openapi` from the product root.
