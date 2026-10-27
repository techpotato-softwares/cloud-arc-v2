"""Least-privilege grants for API and worker roles."""

from __future__ import annotations

import json

from aws_cdk import Aws
from aws_cdk import aws_iam as iam

from constructs.platform import Platform
from constructs.security import GROUP_PERMISSIONS
from forgearc_ai_aws.aws import api_statements, worker_statements


def runtime_environment(platform: Platform) -> dict[str, str]:
    issuer = (
        f"https://cognito-idp.{Aws.REGION}.amazonaws.com/{platform.user_pool.user_pool_id}"
    )
    return {
        "APP_NAME": "forgearc-ai",
        "FORGEARC_AI_ENVIRONMENT": "prod" if platform.is_prod else "local",
        "FORGEARC_AI_CLOUD": "aws",
        "FORGEARC_AI_BUCKET": platform.documents.bucket_name,
        "FORGEARC_AI_QUEUE_URL": platform.queue.queue_url,
        "FORGEARC_AI_SECRET_ID": platform.provider_secret.secret_name,
        "FORGEARC_AI_AUTH_MODE": "oidc",
        "FORGEARC_AI_OIDC_ISSUER": issuer,
        "FORGEARC_AI_OIDC_AUDIENCE": platform.user_pool_client.user_pool_client_id,
        "FORGEARC_AI_OIDC_JWKS_URL": f"{issuer}/.well-known/jwks.json",
        "FORGEARC_AI_OIDC_TENANT_CLAIM": "custom:tenant_id",
        "FORGEARC_AI_OIDC_PERMISSIONS_CLAIM": "permissions",
        "FORGEARC_AI_OIDC_MODULES_CLAIM": "modules",
        "FORGEARC_AI_OIDC_GROUPS_CLAIM": "cognito:groups",
        "FORGEARC_AI_OIDC_DEFAULT_MODULES": "ai",
        "FORGEARC_AI_GROUP_PERMISSIONS": json.dumps(GROUP_PERMISSIONS, separators=(",", ":")),
        "DB_SECRET_ARN": platform.database_secret.secret_arn,
        "DB_HOST": platform.proxy.endpoint,
        "DB_PORT": "5432",
        "DB_NAME": platform.database_name,
        "COGNITO_USER_POOL_ID": platform.user_pool.user_pool_id,
        "COGNITO_CLIENT_ID": platform.user_pool_client.user_pool_client_id,
        "COGNITO_ISSUER": issuer,
        "WORKER_CONCURRENCY": "4" if platform.is_prod else "2",
        "WEB_CONCURRENCY_LIMIT": "32",
        "PYTHONDONTWRITEBYTECODE": "1",
    }


def grant_application(role: iam.IRole, platform: Platform, *, worker: bool) -> None:
    region = Aws.REGION
    statements = (
        worker_statements(
            platform.documents.bucket_arn,
            platform.queue.queue_arn,
            platform.provider_secret.secret_arn,
            region,
        )
        if worker
        else api_statements(
            platform.documents.bucket_arn,
            platform.queue.queue_arn,
            platform.provider_secret.secret_arn,
            region,
        )
    )
    for statement in statements:
        role.add_to_principal_policy(
            iam.PolicyStatement(
                actions=list(statement["actions"]),
                resources=list(statement["resources"]),
            )
        )
    platform.database_secret.grant_read(role)
    if worker:
        platform.key.grant_decrypt(role)
    else:
        platform.key.grant_encrypt_decrypt(role)
