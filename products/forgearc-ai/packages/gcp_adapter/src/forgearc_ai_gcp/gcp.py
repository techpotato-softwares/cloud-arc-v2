"""ForgeArc AI GCP adapter. Licensed to the purchasing organization."""

from __future__ import annotations

import json


class GcsDocuments:
    def __init__(self, client=None):
        self.client = client

    def put(self, bucket: str, key: str, content: bytes) -> None:
        client = self._client()
        if hasattr(client, "upload"):
            client.upload(bucket, key, content)
            return
        client.bucket(bucket).blob(key).upload_from_string(content)

    def get(self, bucket: str, key: str) -> bytes:
        client = self._client()
        if hasattr(client, "download"):
            return client.download(bucket, key)
        return client.bucket(bucket).blob(key).download_as_bytes()

    def _client(self):
        if self.client is not None:
            return self.client
        from google.cloud import storage

        return storage.Client()


class FirestoreJobs:
    def __init__(
        self,
        client=None,
        *,
        project: str = "",
        database: str = "(default)",
    ):
        self.client = client
        self.project = project
        self.database = database

    def put(self, job_id: str, fields: dict) -> None:
        client = self._client()
        if hasattr(client, "put"):
            client.put(job_id, fields)
            return
        client.collection("jobs").document(job_id).set(fields)

    def get(self, job_id: str) -> dict | None:
        client = self._client()
        if hasattr(client, "get"):
            return client.get(job_id)
        snapshot = client.collection("jobs").document(job_id).get()
        return snapshot.to_dict() if snapshot.exists else None

    def _client(self):
        if self.client is not None:
            return self.client
        from google.cloud import firestore

        self.client = firestore.Client(
            project=self.project or None,
            database=self.database,
        )
        return self.client


class GooglePubSubPublisher:
    def publish(self, topic: str, data: bytes):
        from google.cloud import pubsub_v1

        return pubsub_v1.PublisherClient().publish(topic, data)


class PubSubQueue:
    def __init__(self, publisher, topic: str, jobs: FirestoreJobs | None = None):
        self.publisher = publisher
        self.topic = topic
        self.jobs = jobs

    def send(self, job_id: str, payload: dict | None = None) -> None:
        data = (
            json.dumps(payload, separators=(",", ":")).encode()
            if payload
            else job_id.encode()
        )
        if hasattr(self.publisher, "publish"):
            published = self.publisher.publish(self.topic, data)
            if hasattr(published, "result"):
                published.result()
        else:
            self.publisher.send(self.topic, job_id)
        if self.jobs is not None:
            self.jobs.put(job_id, {"status": "queued"})

    def record_status(self, job_id: str, status: str, error: str = "") -> None:
        if self.jobs is not None:
            self.jobs.put(job_id, {"status": status, "error": error})


def load_secret(client, secret_id: str) -> dict:
    if hasattr(client, "access"):
        raw = client.access(secret_id)
    else:
        response = client.access_secret_version(name=secret_id)
        raw = response.payload.data.decode()
    return json.loads(raw)
