# ArcForge Python CDK

Infrastructure-as-code for the Python CloudArc kit — **Python CDK** (`aws-cdk-lib`), same architecture as the Node kit’s TypeScript CDK.

## Layout

```text
cdk/
├── app.py                         # entry (cdk.json → python3 app.py)
├── requirements.txt
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
└── utils/manifest_reader.py       # reads ../api/app-manifest.json
```

## Prerequisites

- Python 3.12+
- Node.js 20+ (CDK CLI only: `npm i -g aws-cdk` or `npx cdk`)
- AWS credentials configured

```bash
cd ../api
python layers/shared/python/scripts/build_layer.py
```

## Setup & deploy

```bash
cd cdk
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cdk synth ApiStack-dev
cdk deploy ApiStack-dev --require-approval never
```

Or: `./scripts/deploy.sh dev`

Lambdas: `arcforge-py-{auth|demo|ai}-{env}`  
Layer: `arcforge-py-shared-layer-{env}`  
Handlers from [`../api/app-manifest.json`](../api/app-manifest.json).

> The CDK **CLI** still needs Node; the **infra code** is pure Python.
