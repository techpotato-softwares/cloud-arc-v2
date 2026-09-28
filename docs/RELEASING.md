# Releasing products

```bash
pnpm pack:node
pnpm pack:python
pnpm pack:ai
```

Exporters first build and test source, stage only one product, generate its
local workspace manifest and lock, install from that frozen lock, and rerun
smoke tests. ZIP timestamps and entry ordering are normalized. Outputs are
written to `releases/`.

Before delivery, verify the product version, catalog entitlement IDs,
onboarding email, checksum, and license terms. Never add credentials, local
databases, environment files, dependency directories, or generated deployment
state to an artifact.
