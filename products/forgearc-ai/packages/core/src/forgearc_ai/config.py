from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, model_validator

from forgearc_ai.errors import ConfigError

ENV_PATTERN = re.compile(r"\$\{([^}]+)\}")

CLOUD_DEFAULTS = {
    "local": {
        "chat": {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "allowlist": ["gpt-4o-mini"],
        },
        "embeddings": {
            "provider": "openai",
            "model": "text-embedding-3-small",
            "allowlist": ["text-embedding-3-small"],
        },
        "documents_provider": "memory",
        "jobs_provider": "inline",
    },
    "aws": {
        "chat": {
            "provider": "bedrock",
            "model": "anthropic.claude-3-5-sonnet-20240620-v1:0",
            "allowlist": ["anthropic.claude-3-5-sonnet-20240620-v1:0"],
        },
        "embeddings": {
            "provider": "bedrock",
            "model": "amazon.titan-embed-text-v2:0",
            "allowlist": ["amazon.titan-embed-text-v2:0"],
        },
        "documents_provider": "s3",
        "jobs_provider": "sqs",
    },
    "gcp": {
        "chat": {
            "provider": "vertex",
            "model": "gemini-2.0-flash",
            "allowlist": ["gemini-2.0-flash"],
        },
        "embeddings": {
            "provider": "vertex",
            "model": "text-embedding-004",
            "allowlist": ["text-embedding-004"],
        },
        "documents_provider": "gcs",
        "jobs_provider": "pubsub",
    },
}


class AuthConfig(BaseModel):
    jwt_secret: str = ""
    issuer: str = "forgearc-ai"
    audience: str = "forgearc-ai-client"
    expires_minutes: int = 720


class LocalUser(BaseModel):
    email: str
    password: str
    tenant_id: str
    permissions: list[str] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=lambda: ["ai"])


class ModelPricing(BaseModel):
    input_per_million: float = 0
    output_per_million: float = 0


class ProviderConfig(BaseModel):
    provider: str
    model: str
    allowlist: list[str] = Field(default_factory=list)


class JevConfig(BaseModel):
    enabled: bool = True
    model: str = "jev-1.13.0"
    base_url: str = "https://api.typesafe.ai"
    review_confidence: float = 0.8
    api_key: str = ""


class LimitConfig(BaseModel):
    prompt_chars: int = 8000
    requests_per_minute: int = 60
    job_attempts: int = 3


class BudgetConfig(BaseModel):
    monthly_usd: float = 25


class WebhookConfig(BaseModel):
    url: str = ""
    secret: str = ""


class Settings(BaseModel):
    environment: Literal["local", "test", "prod"] = "local"
    cloud: Literal["local", "aws", "gcp"] = "local"
    auth: AuthConfig = Field(default_factory=AuthConfig)
    local_users: list[LocalUser] = Field(default_factory=list)
    chat: ProviderConfig
    embeddings: ProviderConfig
    documents_provider: str = "memory"
    vector_provider: str = "memory"
    jobs_provider: str = "inline"
    bucket: str = "forgearc-ai-docs"
    queue_url: str = ""
    secret_id: str = ""
    database_url: str = ""
    aws_region: str = "us-east-1"
    gcp_project: str = ""
    gcp_location: str = ""
    firestore_database: str = "(default)"
    openai_api_key: str = ""
    pricing: dict[str, ModelPricing] = Field(default_factory=dict)
    moderation_terms: list[str] = Field(default_factory=list)
    tool_allowlist: list[str] = Field(default_factory=lambda: ["retrieve_documents"])
    limits: LimitConfig = Field(default_factory=LimitConfig)
    budget: BudgetConfig = Field(default_factory=BudgetConfig)
    jev: JevConfig = Field(default_factory=JevConfig)
    webhook: WebhookConfig = Field(default_factory=WebhookConfig)
    chunk_chars: int = 800
    top_k: int = 4

    @model_validator(mode="before")
    @classmethod
    def apply_cloud_defaults(cls, value: Any) -> Any:
        data = dict(value or {})
        cloud = data.get("cloud") or "local"
        if cloud not in CLOUD_DEFAULTS:
            return data
        for key, default in CLOUD_DEFAULTS[cloud].items():
            data.setdefault(key, default)
        return data


def _expand(value: Any, environ: dict[str, str]) -> Any:
    if isinstance(value, str):
        return ENV_PATTERN.sub(lambda match: environ.get(match.group(1), ""), value)
    if isinstance(value, list):
        return [_expand(item, environ) for item in value]
    if isinstance(value, dict):
        return {key: _expand(item, environ) for key, item in value.items()}
    return value


def find_config() -> Path:
    override = os.environ.get("FORGEARC_AI_CONFIG")
    if override:
        return Path(override)
    starts = [Path.cwd(), Path(__file__).resolve()]
    for start in starts:
        for parent in [start, *start.parents]:
            candidate = parent / "forgearc-ai.yaml"
            if candidate.exists():
                return candidate
    raise ConfigError("forgearc-ai.yaml was not found. Set FORGEARC_AI_CONFIG.")


def load_settings(path: Path | None = None, environ: dict[str, str] | None = None) -> Settings:
    source = Path(path) if path else find_config()
    environment = environ if environ is not None else dict(os.environ)
    raw = yaml.safe_load(source.read_text(encoding="utf-8")) or {}
    expanded = _expand(raw, environment)
    expanded.update(_environment_overrides(environment))
    settings = Settings.model_validate(expanded)
    return validate_settings(settings)


def _environment_overrides(environ: dict[str, str]) -> dict[str, str]:
    names = {
        "FORGEARC_AI_ENVIRONMENT": "environment",
        "FORGEARC_AI_CLOUD": "cloud",
        "FORGEARC_AI_BUCKET": "bucket",
        "FORGEARC_AI_QUEUE_URL": "queue_url",
        "AWS_REGION": "aws_region",
        "GCP_PROJECT": "gcp_project",
        "GCP_LOCATION": "gcp_location",
        "FORGEARC_AI_FIRESTORE_DATABASE": "firestore_database",
    }
    return {
        setting: environ[name]
        for name, setting in names.items()
        if environ.get(name)
    }


def validate_settings(settings: Settings) -> Settings:
    if settings.environment == "prod" and settings.chat.provider == "fake":
        raise ConfigError("The fake provider cannot be selected in production.")
    if settings.environment == "prod" and settings.local_users:
        raise ConfigError("Local passwords are not allowed in production.")
    if settings.jev.enabled and (
        settings.jev.model.endswith("-latest") or settings.jev.model.endswith("-preview")
    ):
        raise ConfigError("Pin a Jev model version. Aliases can change results without a code change.")
    if settings.chat.model not in settings.chat.allowlist:
        raise ConfigError(f"Chat model {settings.chat.model} is not in the allowlist.")
    if settings.embeddings.model not in settings.embeddings.allowlist:
        raise ConfigError(f"Embedding model {settings.embeddings.model} is not in the allowlist.")
    if settings.environment != "prod":
        if not settings.auth.jwt_secret:
            settings.auth.jwt_secret = "local-dev-secret"
        return settings
    missing = []
    if not settings.auth.jwt_secret:
        missing.append("JWT_SECRET")
    if settings.chat.provider == "openai" and not settings.openai_api_key:
        missing.append("OPENAI_API_KEY")
    if settings.chat.provider == "bedrock" and not settings.aws_region:
        missing.append("AWS_REGION")
    if settings.chat.provider == "vertex" and not settings.gcp_project:
        missing.append("GCP_PROJECT")
    if settings.chat.provider == "vertex" and not settings.gcp_location:
        missing.append("GCP_LOCATION")
    if settings.jev.enabled and not settings.jev.api_key:
        missing.append("JEV_API_KEY")
    if settings.secret_id == "" and settings.chat.provider == "openai":
        missing.append("FORGEARC_AI_SECRET_ID")
    if missing:
        raise ConfigError("Missing production credentials: " + ", ".join(missing))
    return settings
