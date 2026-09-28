# Deploy ForgeArc AI on AWS

## Before synthesis

Configure the AWS account and region, select Bedrock model IDs that are available in that region, and prepare provider secrets. The AWS adapter is the only package that imports `boto3`.

```bash
cd products/forgearc-ai/infra/cdk
pnpm dlx aws-cdk@2 synth AiStack-dev
```

<ArchitectureMap title="ForgeArc AI on AWS" preset="ai-aws" />

The stack creates API Gateway, API and worker Lambdas, a private encrypted S3 bucket, SQS plus DLQ, Secrets Manager, an SNS-backed DLQ alarm, and narrowly scoped IAM statements.

## Production packaging

The CDK synth asset is a deployment shim in the MVP. Before deployment, build a Lambda-compatible dependency bundle containing the API host, core, AWS adapter, and locked third-party packages. Run the release exporter and staging smoke test from the same commit.

## Smoke gate

```bash
FORGEARC_AWS_SMOKE=1 bash products/forgearc-ai/scripts/smoke_aws.sh
```

Acceptance requires authentication, ingestion, completed job state, a real Bedrock streamed answer with citations, and a recorded token cost.
