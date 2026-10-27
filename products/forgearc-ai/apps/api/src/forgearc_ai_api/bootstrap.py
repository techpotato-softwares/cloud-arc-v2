"""Resolve runtime settings before the ASGI application is imported."""

from __future__ import annotations

import json
import os
import shlex
import sys
from urllib.parse import quote


def prepare_database_url() -> None:
    """Build DATABASE_URL from Secrets Manager when the host is injected separately.

    The RDS-managed secret points at the cluster. DB_HOST is the RDS Proxy endpoint,
    so pooled clients never connect to the writer directly. Passwords stay out of the
    task definition and are picked up again after rotation.
    """

    if os.environ.get("DATABASE_URL"):
        return
    secret_id = os.environ.get("DB_SECRET_ARN", "")
    host = os.environ.get("DB_HOST", "")
    if not secret_id or not host:
        return
    import boto3

    response = boto3.client("secretsmanager").get_secret_value(SecretId=secret_id)
    data = json.loads(response["SecretString"])
    user = quote(str(data["username"]), safe="")
    password = quote(str(data["password"]), safe="")
    port = os.environ.get("DB_PORT") or str(data.get("port") or 5432)
    name = os.environ.get("DB_NAME") or str(data.get("dbname") or "forgearc_ai")
    os.environ["DATABASE_URL"] = (
        f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}?sslmode=require"
    )


def main() -> None:
    prepare_database_url()
    if "--export" in sys.argv:
        url = os.environ.get("DATABASE_URL", "")
        if url:
            print(f"export DATABASE_URL={shlex.quote(url)}")


if __name__ == "__main__":
    main()
