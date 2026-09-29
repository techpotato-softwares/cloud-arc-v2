"""ForgeArc AI AWS adapter. Licensed to the purchasing organization."""

from __future__ import annotations

import json


class S3Documents:
    def __init__(self, client=None, region: str = ""):
        self.client = client
        self.region = region

    def put(self, bucket: str, key: str, content: bytes) -> None:
        self._client().put_object(Bucket=bucket, Key=key, Body=content)

    def get(self, bucket: str, key: str) -> bytes:
        response = self._client().get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    def _client(self):
        if self.client is not None:
            return self.client
        import boto3

        self.client = boto3.client("s3", region_name=self.region or None)
        return self.client


class SqsQueue:
    def __init__(self, client, queue_url: str, region: str = ""):
        self.client = client
        self.queue_url = queue_url
        self.region = region

    def send(self, job_id: str, payload: dict | None = None) -> None:
        body = json.dumps(payload, separators=(",", ":")) if payload else job_id
        self._client().send_message(QueueUrl=self.queue_url, MessageBody=body)

    def record_status(self, job_id: str, status: str, error: str = "") -> None:
        return None

    def _client(self):
        if self.client is not None:
            return self.client
        import boto3

        self.client = boto3.client("sqs", region_name=self.region or None)
        return self.client


def load_secret(client, secret_id: str) -> dict:
    response = client.get_secret_value(SecretId=secret_id)

    return json.loads(response["SecretString"])


def api_statements(bucket_arn: str, queue_arn: str, secret_arn: str, region: str) -> list[dict]:
    return [
        {"actions": ["s3:GetObject", "s3:PutObject"], "resources": [f"{bucket_arn}/*"]},
        {"actions": ["sqs:SendMessage"], "resources": [queue_arn]},
        {"actions": ["secretsmanager:GetSecretValue"], "resources": [secret_arn]},
        {
            "actions": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
            "resources": [f"arn:aws:bedrock:{region}::foundation-model/*"],
        },
    ]


def worker_statements(bucket_arn: str, queue_arn: str, secret_arn: str, region: str) -> list[dict]:
    return [
        {"actions": ["s3:GetObject"], "resources": [f"{bucket_arn}/*"]},
        {"actions": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"], "resources": [queue_arn]},
        {"actions": ["secretsmanager:GetSecretValue"], "resources": [secret_arn]},
        {
            "actions": ["bedrock:InvokeModel"],
            "resources": [f"arn:aws:bedrock:{region}::foundation-model/*"],
        },
    ]
