# Python modules and data

Route paths match the Node kit. Implementation is Controller → Service → Repository, with Pydantic on the way in.

## Platform

| Lambda file | Routes | Notes |
| --- | --- | --- |
| `modules/platform/lambdas/auth.py` | `POST /api/login`, `POST /api/auth/refresh`, `GET /health` | `@ApiPublic` |
| `modules/platform/lambdas/user.py` | `/api/user`, `/api/user/{id}` | permission codes `user:*` |
| `modules/platform/lambdas/role.py` | `/api/role`, `/api/role/{id}` | role permissions |
| `modules/platform/lambdas/permission.py` | `/api/permission`, `/api/permission/{id}` | permission permissions |

Login loads the user, checks the bcrypt password, reads the tenant's `modules_enabled`, and signs a JWT. Refresh checks the refresh token and signs a new access token.

Health is a controller on the auth Lambda so a monitor can call one stable path:

```json
{ "success": true, "data": { "status": "ok", "product": "forgearc-python" } }
```

## Demo

`modules/demo/` is the copy-this module.

| Piece | File role |
| --- | --- |
| Controller | `POST/GET/PUT/DELETE` under `/api/demo/items`, decorators for permission and module |
| Service | Validates the write and calls the repository |
| Repository | SQLModel queries filtered by `tenant_id` |
| Schema | Pydantic body for create and update, attached with `@ApiBody` |

`GET /api/demo/items?page=1&limit=20` returns `data.data` plus `data.pagination`.

## Files

`modules/files/` has a controller and a service, and no repository. `utils/s3.py` signs the URL. The route fails closed when `S3_BUCKET_NAME` is missing.

<Mermaid chart="sequenceDiagram
  participant Client
  participant Files as files_lambda
  participant S3
  Client->>Files: POST /api/files/presign fileName
  Files->>S3: presign PUT
  Files-->>Client: url and s3Key
  Client->>S3: PUT object
  Client->>Files: POST /api/files/download s3Key
  Files-->>Client: presigned GET" />

## AI stub

`modules/ai/src/providers.py` selects `stub`, `openai`, or `bedrock` from `AI_PROVIDER`. All three return a local string. The OpenAI class does not call the API. The Bedrock class does not call `bedrock-runtime`. CDK already grants the AI Lambda `bedrock:InvokeModel`, so the permission is ready for the later kit.

`POST /api/ai/chat` body is `{ "message": string }`. Permission `ai:chat` or `admin`. Module `ai`.

## Tables

| Table | Used by |
| --- | --- |
| users, roles, permissions, role-permission joins | platform |
| tenants (`modules_enabled`) | login and `@RequireModule` |
| demo_items (`tenant_id`) | demo |

There is no embeddings table. pgvector is available in the local Docker image and unused by the current schema.
