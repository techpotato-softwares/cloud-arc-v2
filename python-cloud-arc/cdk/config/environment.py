"""Environment configuration for ArcForge Python CDK."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

Environment = Literal["dev", "qa", "prod"]


@dataclass
class FeatureFlags:
    s3: bool = False
    sqs: bool = False
    dynamodb: bool = False
    ses: bool = False
    vpc: bool = False
    cognito: bool = False
    kms: bool = False
    static_site: bool = False
    rds: bool = False


@dataclass
class DatabaseConfig:
    host: str
    port: int
    name: str
    ssl: bool


@dataclass
class JwtConfig:
    secret_id: str
    expires_in: str
    refresh_expires_in: str


@dataclass
class EnvironmentConfig:
    environment: Environment
    stack_name: str
    description: str
    db_secret_id: str
    log_retention_days: int
    lambda_memory_size: int
    lambda_timeout: int
    api_stage_name: str
    enable_xray: bool
    tags: dict[str, str]
    features: FeatureFlags
    database: DatabaseConfig
    jwt: JwtConfig
    custom_domain: str | None = None
    cloudfront_certificate_arn: str | None = None


APP = os.environ.get("APP_NAME", "arcforge")

_BASE_TAGS = {
    "Project": "ArcForge",
    "Application": "CloudArc",
    "ManagedBy": "CDK",
    "Runtime": "python",
}

ENVIRONMENT_CONFIGS: dict[Environment, EnvironmentConfig] = {
    "dev": EnvironmentConfig(
        environment="dev",
        stack_name="ApiStack-dev",
        description="ArcForge Python API - Development Environment",
        db_secret_id=f"/{APP}/dev/db",
        log_retention_days=7,
        lambda_memory_size=256,
        lambda_timeout=30,
        api_stage_name="dev",
        enable_xray=False,
        tags={**_BASE_TAGS, "Environment": "dev"},
        features=FeatureFlags(s3=True, static_site=False, rds=False),
        database=DatabaseConfig(
            host=os.environ.get("DB_HOST", "localhost"),
            port=5432,
            name=os.environ.get("DB_NAME", "arcforge"),
            ssl=False,
        ),
        jwt=JwtConfig(
            secret_id=f"/{APP}/dev/jwt",
            expires_in="15m",
            refresh_expires_in="1d",
        ),
    ),
    "qa": EnvironmentConfig(
        environment="qa",
        stack_name="ApiStack-qa",
        description="ArcForge Python API - QA Environment",
        db_secret_id=f"/{APP}/qa/db",
        log_retention_days=14,
        lambda_memory_size=512,
        lambda_timeout=30,
        api_stage_name="qa",
        enable_xray=True,
        tags={**_BASE_TAGS, "Environment": "qa"},
        features=FeatureFlags(s3=True, static_site=False, rds=False),
        database=DatabaseConfig(
            host=os.environ.get("DB_HOST", "REPLACE_WITH_YOUR_DB_HOST"),
            port=5432,
            name=os.environ.get("DB_NAME", "arcforge"),
            ssl=True,
        ),
        jwt=JwtConfig(
            secret_id=f"/{APP}/qa/jwt",
            expires_in="15m",
            refresh_expires_in="7d",
        ),
    ),
    "prod": EnvironmentConfig(
        environment="prod",
        stack_name="ApiStack-prod",
        description="ArcForge Python API - Production Environment",
        db_secret_id=f"/{APP}/prod/db",
        log_retention_days=90,
        lambda_memory_size=1024,
        lambda_timeout=30,
        api_stage_name="prod",
        enable_xray=True,
        tags={**_BASE_TAGS, "Environment": "prod"},
        features=FeatureFlags(s3=True, static_site=False, rds=True),
        database=DatabaseConfig(
            host="",
            port=5432,
            name=os.environ.get("DB_NAME", "arcforge"),
            ssl=True,
        ),
        jwt=JwtConfig(
            secret_id=f"/{APP}/prod/jwt",
            expires_in="2h",
            refresh_expires_in="30d",
        ),
        custom_domain=os.environ.get("CUSTOM_DOMAIN") or None,
        cloudfront_certificate_arn=os.environ.get("CLOUDFRONT_CERTIFICATE_ARN")
        or None,
    ),
}


def get_environment_config(env: Environment) -> EnvironmentConfig:
    return ENVIRONMENT_CONFIGS[env]
