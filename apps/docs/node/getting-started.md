# Getting started

Work inside a copy of `forgearc-node`. The steps below are the shortest path to a health check and a login.

## 1. Database

```bash
docker compose up -d
```

This starts PostgreSQL for Prisma. Leave it running while you develop.

## 2. Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Set `ALLOWED_ORIGINS` before any deploy. `http://localhost:4000` is enough locally. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` if you do not want the seed defaults.

## 3. Install, schema, admin

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:push
pnpm db:seed:admin
```

`db:generate` builds the Prisma client. `db:push` applies the schema to the local database. `db:seed:admin` creates the admin user and the permission codes, including `demo:read`, `demo:write`, `files:read`, `files:write`, and `ai:chat`.

## 4. Run the API

```bash
pnpm build:all
pnpm dev:express
```

`build:all` writes the manifest and OpenAPI document. The dev server listens on port 4000 and forwards every path to the same handlers CDK will deploy.

Check:

```bash
curl http://localhost:4000/health
```

You should see a success envelope whose `data.status` is `ok`.

Then log in:

```bash
curl -s http://localhost:4000/api/login \
  -H 'content-type: application/json' \
  -d '{"username":"ADMIN_EMAIL","password":"ADMIN_PASSWORD"}'
```

Use the `accessToken` as `Authorization: Bearer ...` on `GET /api/demo/items?page=1&limit=20`.

## 5. Deploy

```bash
pnpm synth
pnpm --filter @forgearc/cdk deploy:dev
```

Use your own AWS account. The stack name is `ApiStack-dev`. After deploy, point the database URL and `JWT_SECRET_ID` at the resources in that account, restrict CORS, and run the seed against that database.

File routes need the S3 bucket env `S3_BUCKET_NAME`. Dev enables S3. Dev does not create RDS.

## If something fails

| Symptom | Check |
| --- | --- |
| Health connection refused | Dev server not on port 4000, or Docker database not up |
| Login 401 | Seed did not run, or the password in `.env` does not match the body |
| 403 on `/api/demo/items` | Token missing `demo:read`, or the tenant is missing module `demo` |
| New route missing in AWS | `pnpm build:all` was not run before `cdk deploy` |
