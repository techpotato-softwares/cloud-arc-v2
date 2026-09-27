# Dependency boundaries

- `apps/*` may use internal root packages and services.
- `services/commerce` may read `packages/commercial-catalog`.
- `products/*` must not import from root `apps`, `services`, or `packages`.
- Product modules depend on their own `packages/shared`, never another product.
- CDK may package its product's generated API artifacts and shared layer only.
- Node and Python parity is maintained through manifests, OpenAPI, and tests,
  not a coupled cross-language runtime.
- Secrets, local databases, caches, dependency folders, and generated bundles
  are excluded from standalone releases.
