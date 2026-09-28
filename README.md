# ForgeArc polyglot monorepo

One governed workspace contains the ForgeArc web properties, commerce service,
and independently exportable ForgeArc products.

```text
apps/                 Documentation and marketing applications
services/commerce/    Checkout, entitlements, email, and delivery API
packages/             Internal catalog and web configuration
products/             ForgeArc Node, ForgeArc Python, and ForgeArc AI
product-specs/        Product and go-to-market source documents
tooling/release/      Standalone product exporters
infra/cdk/            Production AWS platform infrastructure
```

## Prerequisites and setup

- Node.js 22.13+, pnpm 11.0.9
- Python 3.12+, uv 0.12+

```bash
pnpm install
uv sync --all-packages --frozen
pnpm check
```

Use `pnpm docs:dev`, `pnpm marketing:dev`, and `pnpm commerce:dev` for local
applications. Turborepo orchestrates JavaScript tasks; uv owns every supported
Python environment and command.

## Products and releases

- [`products/forgearc-node`](products/forgearc-node/README.md)
- [`products/forgearc-python`](products/forgearc-python/README.md)
- [`products/forgearc-ai`](products/forgearc-ai/README.md)

Product runtime code does not import root-only apps, services, or commercial
packages. Build isolated buyer artifacts with:

```bash
pnpm pack:node
pnpm pack:python
pnpm pack:ai
```

Each exporter generates a product-local lock and reruns installation and tests
without access to the repository workspace.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md), and
[`docs/RELEASING.md`](docs/RELEASING.md). Production deployment is documented
in [`docs/DEPLOYING-PLATFORM.md`](docs/DEPLOYING-PLATFORM.md).
