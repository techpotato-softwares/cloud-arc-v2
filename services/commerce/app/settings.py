from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
COMMERCE_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    test_mode: bool
    table_name: str
    public_base_url: str
    catalog_path: Path
    artifact_dir: Path
    stripe_secret_key: str
    stripe_webhook_secret: str
    razorpay_key_id: str
    razorpay_key_secret: str
    razorpay_webhook_secret: str
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    smtp_from: str
    ses_region: str = ""


def _secret_json(arn: str) -> dict[str, str]:
    if not arn:
        return {}
    import boto3

    value = boto3.client("secretsmanager").get_secret_value(SecretId=arn)["SecretString"]
    return json.loads(value)


def load_settings() -> Settings:
    catalog = os.environ.get("COMMERCE_CATALOG") or str(
        ROOT / "packages" / "commercial-catalog" / "catalog.yaml"
    )
    payment = _secret_json(os.environ.get("COMMERCE_PAYMENT_SECRET_ARN", ""))
    return Settings(
        test_mode=os.environ.get("COMMERCE_TEST_MODE", "false").lower() == "true",
        table_name=os.environ.get("COMMERCE_TABLE", ""),
        public_base_url=os.environ.get("COMMERCE_PUBLIC_BASE_URL", "http://127.0.0.1:4173"),
        catalog_path=Path(catalog),
        artifact_dir=Path(os.environ.get("COMMERCE_ARTIFACT_DIR", COMMERCE_ROOT / "artifacts")),
        stripe_secret_key=os.environ.get("STRIPE_SECRET_KEY", payment.get("stripeSecretKey", "")),
        stripe_webhook_secret=os.environ.get(
            "STRIPE_WEBHOOK_SECRET", payment.get("stripeWebhookSecret", "")
        ),
        razorpay_key_id=os.environ.get("RAZORPAY_KEY_ID", payment.get("razorpayKeyId", "")),
        razorpay_key_secret=os.environ.get(
            "RAZORPAY_KEY_SECRET", payment.get("razorpayKeySecret", "")
        ),
        razorpay_webhook_secret=os.environ.get(
            "RAZORPAY_WEBHOOK_SECRET", payment.get("razorpayWebhookSecret", "")
        ),
        smtp_host=os.environ.get("SMTP_HOST", ""),
        smtp_port=int(os.environ.get("SMTP_PORT", "587")),
        smtp_username=os.environ.get("SMTP_USERNAME", ""),
        smtp_password=os.environ.get("SMTP_PASSWORD", ""),
        smtp_from=os.environ.get("SMTP_FROM", "ForgeArc <hello@forgearc.dev>"),
        ses_region=os.environ.get("SES_REGION", ""),
    )
