"""Python Lambda functions from app-manifest.json."""
from __future__ import annotations

import json
import os

from aws_cdk import CfnOutput, Duration
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
from aws_cdk import aws_logs as logs
from config.environment import EnvironmentConfig
from constructs import Construct
from paths import API_ASSET_EXCLUDES, API_ASSET_ROOT, ENV_LOCAL_JSON
from utils.manifest_reader import AppManifest


def _load_local_env_vars() -> dict[str, str]:
    if not ENV_LOCAL_JSON.exists():
        return {}
    try:
        env_config = json.loads(ENV_LOCAL_JSON.read_text(encoding="utf-8"))
        env_vars = (
            env_config.get("forgearc-auth-dev")
            or env_config.get("Parameters")
            or next(iter(env_config.values()), {})
        )
        if isinstance(env_vars, dict):
            print("   📋 Loaded local env vars from env.local.json")
            return {str(k): str(v) for k, v in env_vars.items()}
    except Exception as exc:  # noqa: BLE001
        print(f"   ⚠️  Failed to parse env.local.json: {exc}")
    return {}


_RETENTION: dict[int, logs.RetentionDays] = {
    1: logs.RetentionDays.ONE_DAY,
    3: logs.RetentionDays.THREE_DAYS,
    5: logs.RetentionDays.FIVE_DAYS,
    7: logs.RetentionDays.ONE_WEEK,
    14: logs.RetentionDays.TWO_WEEKS,
    30: logs.RetentionDays.ONE_MONTH,
    60: logs.RetentionDays.TWO_MONTHS,
    90: logs.RetentionDays.THREE_MONTHS,
    180: logs.RetentionDays.SIX_MONTHS,
    365: logs.RetentionDays.ONE_YEAR,
}


class LambdaConstruct(Construct):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        config: EnvironmentConfig,
        shared_layer: lambda_.LayerVersion,
        manifest: AppManifest,
        db_host: str | None = None,
    ) -> None:
        super().__init__(scope, construct_id)
        self.functions: dict[str, lambda_.Function] = {}
        self._db_host = db_host or config.database.host

        if db_host:
            print(f"   📡 Using database host from RDS: {db_host}")

        for name, lambda_cfg in manifest.lambdas.items():
            self.functions[name] = self._create_lambda(
                name, lambda_cfg.handler, config, shared_layer
            )

        if not self.functions:
            print("   No lambdas in manifest — check apps/api/app-manifest.json")

    def _create_lambda(
        self,
        name: str,
        handler: str,
        config: EnvironmentConfig,
        shared_layer: lambda_.LayerVersion,
    ) -> lambda_.Function:
        environment: dict[str, str] = {
            "ENVIRONMENT": config.environment,
            "APP_NAME": os.environ.get("APP_NAME", "forgearc"),
            "DB_HOST": self._db_host,
            "DB_PORT": str(config.database.port),
            "DB_NAME": config.database.name,
            "DB_SSL": str(config.database.ssl).lower(),
            "DB_SECRET_ID": config.db_secret_id,
            "JWT_SECRET_ID": config.jwt.secret_id,
            "JWT_EXPIRES_IN": config.jwt.expires_in,
            "JWT_REFRESH_EXPIRES_IN": config.jwt.refresh_expires_in,
            "LOG_LEVEL": "INFO" if config.environment == "prod" else "DEBUG",
            "AI_PROVIDER": os.environ.get("AI_PROVIDER", "stub"),
        }
        if config.environment == "dev":
            environment.update(_load_local_env_vars())

        fn = lambda_.Function(
            self,
            f"{name}Function",
            function_name=f"forgearc-py-{name}-{config.environment}",
            description=f"{name.upper()} Python Lambda - {config.environment}",
            runtime=lambda_.Runtime.PYTHON_3_12,
            architecture=lambda_.Architecture.ARM_64,
            handler=handler,
            code=lambda_.Code.from_asset(
                str(API_ASSET_ROOT),
                exclude=API_ASSET_EXCLUDES,
            ),
            memory_size=config.lambda_memory_size,
            timeout=Duration.seconds(config.lambda_timeout),
            environment=environment,
            layers=[shared_layer],
            tracing=(
                lambda_.Tracing.ACTIVE
                if config.enable_xray
                else lambda_.Tracing.DISABLED
            ),
            log_retention=_RETENTION.get(
                config.log_retention_days, logs.RetentionDays.ONE_WEEK
            ),
        )

        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    f"arn:aws:secretsmanager:*:*:secret:{config.db_secret_id}*",
                    f"arn:aws:secretsmanager:*:*:secret:{config.jwt.secret_id}*",
                ],
            )
        )
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources=["*"],
            )
        )

        if name == "ai":
            fn.add_to_role_policy(
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "bedrock:InvokeModel",
                        "bedrock:InvokeModelWithResponseStream",
                    ],
                    resources=["*"],
                )
            )

        CfnOutput(
            self,
            f"{name}FunctionArn",
            value=fn.function_arn,
            description=f"{name.upper()} Python Lambda ARN - {config.environment}",
            export_name=(
                f"ForgeArcPy{name[:1].upper()}{name[1:]}FunctionArn-"
                f"{config.environment}"
            ),
        )
        print(f"   Created Lambda: forgearc-py-{name}-{config.environment}")
        return fn
