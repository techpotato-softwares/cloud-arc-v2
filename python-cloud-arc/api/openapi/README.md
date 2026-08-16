# OpenAPI artifacts

Generated from `@Controller` routes and Pydantic `@ApiBody` schemas — same idea as Node `npm run build:openapi`.

```bash
cd api
python scripts/generate_openapi.py
# → openapi.json and openapi.yaml
```

Do not edit these files by hand. After adding or changing a route, regenerate (and run `python scripts/generate_manifest.py` for CDK).
