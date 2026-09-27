# Node modules

Routes and permission names match the Python kit. A client can call either runtime with the same paths.

## Platform

| Lambda | Method and path | Auth |
| --- | --- | --- |
| auth | `POST /api/login` | Public. Body `{ "username", "password" }` |
| auth | `POST /api/auth/refresh` | Public. Body `{ "refreshToken" }` |
| auth | `GET /health` | Public |
| user | `/api/user` and `/api/user/{id}` | `user:read`, `user:write`, or `user:create` |
| role | `/api/role` and `/api/role/{id}` | role permissions |
| permission | `/api/permission` and `/api/permission/{id}` | permission permissions |

Login returns an access token and a refresh token. The access token includes permission codes, enabled modules, and the tenant id. Later routes trust that token. They do not load the user again for the permission check.

## Demo

`/api/demo/items` is the reference CRUD module.

- `GET` requires `demo:read` or `admin`, and module `demo`
- `POST`, `PUT`, and `DELETE` require `demo:write` or `admin`, and module `demo`
- `GET /api/demo/items?page=1&limit=20` returns the paging envelope
- Create body is `{ "title", "description"?, "status"? }`

Copy this folder when you add a table. Keep SQL in the repository, rules in the service, and HTTP in the controller.

## Files

`POST /api/files/presign` and `POST /api/files/download` return a short-lived S3 URL. The browser uploads or downloads directly to S3. The Lambda never holds the file bytes.

Permissions are `files:write` and `files:read`, module `files`. Without `S3_BUCKET_NAME` the route cannot sign a URL.

## AI

`POST /api/ai/chat` with `{ "message" }` requires `ai:chat` or `admin`, and module `ai`. The handler is a stub. Do not describe it to customers as a live model call.

Full route tables and error shapes: [Modules](/architecture/modules) and [Request path](/architecture/request-path).
