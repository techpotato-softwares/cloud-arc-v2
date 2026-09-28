from __future__ import annotations

from forgearc_ai.config import Settings
from forgearc_ai.di import Container
from forgearc_ai.policy import PolicyGate
from forgearc_ai.providers.fake import FakeChatProvider
from forgearc_ai.providers.jev import JevProvider
from forgearc_ai.providers.openai import OpenAIProvider
from forgearc_ai.services import ChatService, DecisionService, IngestionService, UsageService
from forgearc_ai.stores import MemoryGraph
from forgearc_ai_aws.aws import S3Documents, SqsQueue
from forgearc_ai_aws.bedrock import BedrockProvider


def build_container(settings: Settings, *, jev_transport=None, openai_transport=None, bedrock_client=None, s3_client=None, sqs_client=None) -> Container:
    container = Container()
    store = MemoryGraph()
    gate = PolicyGate(settings)
    provider = _chat_provider(settings, openai_transport, bedrock_client)
    documents = S3Documents(s3_client) if s3_client is not None else None
    queue = SqsQueue(sqs_client, settings.queue_url) if sqs_client is not None else None
    jev = JevProvider(settings.jev.api_key, settings.jev.model, settings.jev.base_url, settings.jev.review_confidence, jev_transport)
    container.bind_constant("Settings", settings)
    container.bind_constant("Store", store)
    container.bind_constant("ChatService", ChatService(settings, provider, gate, store))
    container.bind_constant("IngestionService", IngestionService(settings, provider, store, documents, queue))
    container.bind_constant("DecisionService", DecisionService(settings, jev, gate, store))
    container.bind_constant("UsageService", UsageService(store))
    return container


def _chat_provider(settings: Settings, openai_transport, bedrock_client):
    allowlist = list(dict.fromkeys([*settings.chat.allowlist, *settings.embeddings.allowlist]))
    if settings.chat.provider == "openai":
        return OpenAIProvider(settings.openai_api_key, settings.chat.model, settings.embeddings.model, allowlist, openai_transport)
    if settings.chat.provider == "bedrock":
        return BedrockProvider(settings.chat.model, settings.embeddings.model, allowlist, settings.aws_region, bedrock_client)
    return FakeChatProvider(settings.chat.model, allowlist)
