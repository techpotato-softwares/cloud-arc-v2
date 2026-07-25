# ECS Express containers (Phase 1)

Docker images for modules with `"compute": "ecs"` in `module.manifest.json`:

- `invoicing`
- `mobile-api`
- `ai-service`

Each container bundles the Fastify entry from `../modules/{sku}/` (not the Lambda layer).
