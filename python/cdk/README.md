# ArcForge Python CDK notes

Attach the shared layer built by `layers/shared/python/scripts/build_layer.py`
to `PythonFunction` (or container image) resources.

You can reuse the root `cdk/` ApiStack pattern with `runtime: python` in
`app-manifest.json`, or deploy this folder as a sibling stack:

```ts
new lambda.Function(this, "AuthPy", {
  runtime: lambda.Runtime.PYTHON_3_12,
  handler: "modules.platform.handlers.auth.handler",
  code: lambda.Code.fromAsset("../python"),
  layers: [pythonLayer],
});
```

See `../app-manifest.json` for route → handler mapping.
