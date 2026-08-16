# ArcForge Node — Changelog

## 1.0.1 — 2026-08-16

- Public `GET /health` on the auth lambda; `X-Request-Id` on responses; `ALLOWED_ORIGINS` for CORS
- AI is Controller → Service; files SKU (`POST /api/files/presign`, `/download`)
- Paginated demo list; `files:read` / `files:write` in seed-admin
- Node CI (eslint + tests); docs: CSR-AND-DI, API contract (RBAC + files + health)

## 1.0.0 — 2026-07-23

- Rebrand to ArcForge / `@arcforge/*`
- Slim schema: Tenant, User, Role, Permission, DemoItem
- `@RequirePermission` / `@RequireModule` enforcement
- Closed public user registration
- Demo + AI modules; ERP stubs moved internal
- Jest tests + GitHub Actions
- Security scrub (no hardcoded DB passwords / customer domains)
