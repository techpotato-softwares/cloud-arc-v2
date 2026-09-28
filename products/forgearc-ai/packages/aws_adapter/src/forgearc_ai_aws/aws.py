"""ForgeArc AI AWS adapter. Licensed to the purchasing organization."""

from __future__ import annotations


class S3Documents:
    def __init__(self, client):
        self.client = client

    def put(self, bucket: str, key: str, content: bytes) -> None:
        self.client.put_object(Bucket=bucket, Key=key, Body=content)

    def get(self, bucket: str, key: str) -> bytes:
        response = self.client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()


class SqsQueue:
    def __init__(self, client, queue_url: str):
        self.client = client
        self.queue_url = queue_url

    def send(self, job_id: str) -> None:
        self.client.send_message(QueueUrl=self.queue_url, MessageBody=job_id)


def load_secret(client, secret_id: str) -> dict:
    response = client.get_secret_value(SecretId=secret_id)
    import json

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
