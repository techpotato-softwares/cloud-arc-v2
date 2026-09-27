# OpenAPI artifacts

Generated from `@Controller` routes and Pydantic `@ApiBody` schemas — same idea as Node `pnpm build:openapi`.

```bash
cd apps/api
uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py
# → openapi.json and openapi.yaml
```

Do not edit these files by hand. After adding or changing a route, regenerate (and run `uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py` for CDK).
