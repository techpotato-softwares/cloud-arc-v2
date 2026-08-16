# API contract (Node + Python)

Shared paths so buyers can compare runtimes. HTTP paths, JWT gates, and JSON envelopes are identical in both kits.

Public routes skip JWT. All others require `Authorization: Bearer <accessToken>` plus the listed permission (or `admin`) and, where noted, the tenant SKU in `modulesEnabled`.

Responses include `X-Request-Id` (echo of the request header, or the Lambda request id). CORS origins come from `ALLOWED_ORIGINS` (comma-separated; default `*`).

Python implements routes with Controller → Service → Repository; see [CSR-AND-DI.md](CSR-AND-DI.md). Request bodies with `@ApiBody` are validated with Pydantic before the controller runs.

## Envelope

```json
{ "success": true, "data": { } }
```

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "..." } }
```

List endpoints wrap rows and paging:

```json
{
  "success": true,
  "data": {
    "data": [],
    "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
  }
}
```

Query params: `page`, `limit` (and on RBAC lists, `searchKey` / `searchTerm` where implemented).

## Health (public)

| Method | Path |
|--------|------|
| GET | `/health` |

Body: `{ "status": "ok", "product": "arcforge-python" }`. Served by the **auth** lambda so API Gateway has a liveness route.

## Auth (public)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/login` | `{ "username", "password" }` |
| POST | `/api/auth/refresh` | `{ "refreshToken" }` |

## Users (auth + `user:read` / `user:write` / `user:create`)

| Method | Path |
|--------|------|
| GET | `/api/user` |
| POST | `/api/user` |
| GET | `/api/user/{id}` |
| PUT | `/api/user/{id}` |
| DELETE | `/api/user/{id}` |

## Roles

| Method | Path |
|--------|------|
| GET | `/api/role` |
| POST | `/api/role` |
| GET | `/api/role/{id}` |
| PUT | `/api/role/{id}` |
| DELETE | `/api/role/{id}` |

## Permissions

| Method | Path |
|--------|------|
| GET | `/api/permission` |
| POST | `/api/permission` |
| GET | `/api/permission/{id}` |
| PUT | `/api/permission/{id}` |
| DELETE | `/api/permission/{id}` |

## Demo (auth + `demo:read` / `demo:write`, module `demo`)

| Method | Path |
|--------|------|
| GET | `/api/demo/items` |
| POST | `/api/demo/items` |
| GET | `/api/demo/items/{id}` |
| PUT | `/api/demo/items/{id}` |
| DELETE | `/api/demo/items/{id}` |

Create body: `{ "title": string, "description"?: string, "status"?: string }`

`GET /api/demo/items` is paginated (`page`, `limit`).

## AI (auth + `ai:chat`, module `ai`)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/ai/chat` | `{ "message": string }` |

Controller → Service (providers behind the service). Default provider is stub; set `AI_PROVIDER=openai|bedrock` plus credentials for live calls.

## Files (auth + `files:read` / `files:write`, module `files`)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/files/presign` | `{ "fileName": string, "contentType"?: string }` |
| POST | `/api/files/download` | `{ "s3Key": string }` |

Returns a short-lived S3 presigned URL. Requires `S3_BUCKET_NAME`.

## OpenAPI

Regenerate after route or schema changes:

```bash
python scripts/generate_manifest.py
python scripts/generate_openapi.py
```

Artifacts: `api/openapi/` and `api/app-manifest.json`.
