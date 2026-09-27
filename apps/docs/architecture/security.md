# Security

## What the kits enforce

- Access and refresh JWTs. AWS reads the signing key from Secrets Manager. Local reads it from the environment.
- Passwords are hashed with bcrypt. There is no public registration route.
- Non-public routes require `Authorization: Bearer <accessToken>`.
- `@RequirePermission` checks the codes inside the token. `@RequireModule` checks the tenant's enabled modules.
- `GET /health` is public and returns no tenant data.
- Responses include `X-Request-Id`.
- Sold defaults do not contain a cloud account id or a database password.

## What you must set

| Setting | Local | Production |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | `*` is acceptable | Your real origins, comma-separated |
| JWT secret | env | `JWT_SECRET_ID` in Secrets Manager |
| Database password | `.env`, not committed | Secrets Manager, wired by the Lambda |
| `S3_BUCKET_NAME` | optional until you call files | set by CDK when S3 is enabled |
| Admin password | `seed_admin` | rotate after the first login |

Never commit `.env`. Copy from `.env.example` only.

## Known limits

These are real gaps in the current kits, not a future wish list.

| Gap | What to do now |
| --- | --- |
| No WAF or rate limit | Put a rate limit in front of API Gateway before a public launch |
| No Cognito, OAuth, or MFA | Use the built-in JWT login, or plan an enterprise add-on |
| No logout denylist | Shorten access-token lifetime if a stolen token is a concern |
| No database row-level security | Repositories must filter by `tenantId`. Demo does. Do not skip that in new modules |
| AI stub can look successful | Treat `AI_PROVIDER=openai` as unwired until ForgeArc AI replaces it |

## Tenant boundary

The token includes `tenantId`. A repository that lists rows without that filter leaks data across tenants. The demo item repository filters. The user list in the current kit does not. Filter every new query by tenant before you expose it to more than one customer.
