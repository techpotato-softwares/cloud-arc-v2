# ForgeArc Python API host

This package contains the FastAPI development host, contract generators,
scheduled Lambda entrypoints, and tests. Runtime framework code lives in
`../../packages/shared/src`; product controllers live in `../../modules`.

Run commands from the product root:

```bash
uv sync --all-packages --frozen
uv run --package forgearc-python-api pytest apps/api/tests
uv run --package forgearc-python-api uvicorn \
  --app-dir apps/api src.dev_server:app --reload --port 4001
uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py
uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py
```

New controllers are discovered through each module's Lambda registration.
Attach Pydantic request models to route decorators so generated OpenAPI includes
the body schema.
