from __future__ import annotations

from forgearc_ai.config import Settings
from forgearc_ai.di import Container
from forgearc_ai.policy import PolicyGate
from forgearc_ai.providers.fake import FakeChatProvider
from forgearc_ai.providers.jev import JevProvider
from forgearc_ai.providers.openai import OpenAIProvider
from forgearc_ai.services import (
    ChatService,
    DecisionService,
    IngestionService,
    UsageService,
)
from forgearc_ai.stores import MemoryGraph
from forgearc_ai_aws.aws import S3Documents, SqsQueue
from forgearc_ai_aws.bedrock import BedrockProvider


def build_container(
    settings: Settings,
    *,
    jev_transport=None,
    openai_transport=None,
    bedrock_client=None,
    s3_client=None,
    sqs_client=None,
    vertex_client=None,
    gcs_client=None,
    pubsub_publisher=None,
    firestore_client=None,
) -> Container:
    container = Container()
    store = MemoryGraph()
    gate = PolicyGate(settings)
    provider = _chat_provider(settings, openai_transport, bedrock_client, vertex_client)
    documents = _documents(settings, s3_client, gcs_client)
    queue = _queue(settings, sqs_client, pubsub_publisher, firestore_client)
    jev = JevProvider(
        settings.jev.api_key,
        settings.jev.model,
        settings.jev.base_url,
        settings.jev.review_confidence,
        jev_transport,
    )
    container.bind_constant("Settings", settings)
    container.bind_constant("Store", store)
    container.bind_constant("ChatService", ChatService(settings, provider, gate, store))
    container.bind_constant("IngestionService", IngestionService(settings, provider, store, documents, queue))
    container.bind_constant("DecisionService", DecisionService(settings, jev, gate, store))
    container.bind_constant("UsageService", UsageService(store))
    return container


def _chat_provider(settings: Settings, openai_transport, bedrock_client, vertex_client):
    allowlist = list(
        dict.fromkeys([*settings.chat.allowlist, *settings.embeddings.allowlist])
    )
    if settings.chat.provider == "openai":
        return OpenAIProvider(
            settings.openai_api_key,
            settings.chat.model,
            settings.embeddings.model,
            allowlist,
            openai_transport,
        )
    if settings.chat.provider == "bedrock":
        return BedrockProvider(
            settings.chat.model,
            settings.embeddings.model,
            allowlist,
            settings.aws_region,
            bedrock_client,
        )
    if settings.chat.provider == "vertex":
        from forgearc_ai_gcp.vertex import VertexProvider

        return VertexProvider(
            settings.chat.model,
            settings.embeddings.model,
            allowlist,
            settings.gcp_project,
            settings.gcp_location,
            vertex_client,
        )
    return FakeChatProvider(settings.chat.model, allowlist)


def _documents(settings: Settings, s3_client, gcs_client):
    if settings.documents_provider == "gcs":
        from forgearc_ai_gcp.gcp import GcsDocuments

        return GcsDocuments(gcs_client)
    if settings.documents_provider == "s3":
        return S3Documents(s3_client, settings.aws_region)
    return None


def _queue(settings: Settings, sqs_client, pubsub_publisher, firestore_client):
    if settings.jobs_provider == "pubsub":
        from forgearc_ai_gcp.gcp import (
            FirestoreJobs,
            GooglePubSubPublisher,
            PubSubQueue,
        )

        jobs = FirestoreJobs(
            firestore_client,
            project=settings.gcp_project,
            database=settings.firestore_database,
        )
        return PubSubQueue(
            pubsub_publisher or GooglePubSubPublisher(),
            settings.queue_url,
            jobs,
        )
    if settings.jobs_provider == "sqs":
        return SqsQueue(sqs_client, settings.queue_url, settings.aws_region)
    return None
