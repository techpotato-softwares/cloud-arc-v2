# Contributing

Install Node 22.13+, pnpm 11.0.9, Python 3.12+, and uv.

```bash
pnpm install
uv sync --all-packages --frozen
pnpm check
```

Use standard package tasks named `build`, `lint`, `typecheck`, and `test`.
Run Python tools through `uv run`; update dependencies with uv and commit
`uv.lock`. Update pnpm dependencies from the root and commit `pnpm-lock.yaml`.

When changing a ForgeArc capability, preserve Node/Python contract parity,
regenerate its manifest and OpenAPI document, and test the affected standalone
exporter. Follow [dependency boundaries](DEPENDENCY-BOUNDARIES.md).
