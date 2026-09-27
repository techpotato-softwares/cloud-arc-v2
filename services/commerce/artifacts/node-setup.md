# ForgeArc Node setup

1. Accept the private repository invite sent to the license email.
2. Copy `forgearc-node` into a private repository that you control.
3. Start Postgres with `docker compose up -d`.
4. Copy `apps/api/.env.example` to `apps/api/.env` and set `ALLOWED_ORIGINS`.
5. From the product root, run `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:push`, and `pnpm db:seed`.
6. Run `pnpm dev` and open `http://localhost:4000/health`.
7. Put JWT and cloud secrets in AWS Secrets Manager before `pnpm --filter @forgearc/cdk deploy:dev`.
