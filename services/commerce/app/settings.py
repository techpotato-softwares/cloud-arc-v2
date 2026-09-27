from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
COMMERCE_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    test_mode: bool
    database_url: str
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


def load_settings() -> Settings:
    catalog = os.environ.get("COMMERCE_CATALOG") or str(
        ROOT / "packages" / "commercial-catalog" / "catalog.yaml"
    )
    return Settings(
        test_mode=os.environ.get("COMMERCE_TEST_MODE", "false").lower() == "true",
        database_url=os.environ.get("COMMERCE_DATABASE_URL", "sqlite:///./data/commerce.sqlite"),
        public_base_url=os.environ.get("COMMERCE_PUBLIC_BASE_URL", "http://127.0.0.1:4173"),
        catalog_path=Path(catalog),
        artifact_dir=COMMERCE_ROOT / "artifacts",
        stripe_secret_key=os.environ.get("STRIPE_SECRET_KEY", ""),
        stripe_webhook_secret=os.environ.get("STRIPE_WEBHOOK_SECRET", ""),
        razorpay_key_id=os.environ.get("RAZORPAY_KEY_ID", ""),
        razorpay_key_secret=os.environ.get("RAZORPAY_KEY_SECRET", ""),
        razorpay_webhook_secret=os.environ.get("RAZORPAY_WEBHOOK_SECRET", ""),
        smtp_host=os.environ.get("SMTP_HOST", ""),
        smtp_port=int(os.environ.get("SMTP_PORT", "587")),
        smtp_username=os.environ.get("SMTP_USERNAME", ""),
        smtp_password=os.environ.get("SMTP_PASSWORD", ""),
        smtp_from=os.environ.get("SMTP_FROM", "ForgeArc <hello@forgearc.dev>"),
    )
