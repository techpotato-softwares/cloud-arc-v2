# ForgeArc Python CDK

Infrastructure-as-code for the ForgeArc Python kit — **Python CDK** (`aws-cdk-lib`), same architecture as the Node kit’s TypeScript CDK.

## Layout

```text
infra/cdk/
├── app.py                         # entry (cdk.json → python3 app.py)
├── pyproject.toml
├── paths.py                       # api/ + layer asset paths
├── config/
│   ├── environment.py
│   ├── rds_config.py
│   └── s3_config.py
├── stacks/api_stack.py
├── cdk_constructs/
│   ├── core/{lambda,api_gateway,scheduled_lambda}_construct.py
│   ├── database/{rds,rds_scheduler}_construct.py
│   ├── storage/s3_construct.py
│   ├── security/jwt_secrets_construct.py
│   ├── hosting/static_site_construct.py
│   └── permissions/lambda_permissions.py
└── utils/manifest_reader.py       # reads ../apps/api/app-manifest.json
```

## Prerequisites

- Python 3.12+
- Node.js 22.13+ (CDK CLI only: `npm i -g aws-cdk` or `pnpm exec cdk`)
- AWS credentials configured

```bash
cd ../api
python layers/shared/python/scripts/build_layer.py
```

## Setup & deploy

```bash
cd infra/cdk
uv sync --all-packages --frozen
# uv runs commands in the managed environment
uv sync --all-packages --frozen

cdk synth ApiStack-dev
cdk deploy ApiStack-dev --require-approval never
```

Or: `./scripts/deploy.sh dev`

Lambdas: `forgearc-py-{auth|demo|ai}-{env}`  
Layer: `forgearc-py-shared-layer-{env}`  
Handlers from generated [`../apps/api/app-manifest.json`](../apps/api/app-manifest.json)
(`uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py` in `api/`). OpenAPI: `uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py`.

> The CDK **CLI** still needs Node; the **infra code** is pure Python.
