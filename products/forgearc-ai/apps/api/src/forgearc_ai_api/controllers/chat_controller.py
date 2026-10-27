from forgearc_ai.di import Inject
from forgearc_ai.routing import Controller, Post
from forgearc_ai.services import ChatService


@Controller
class ChatController:
    def __init__(self, chat_service: ChatService = Inject("ChatService")):
        self.chat_service = chat_service

    @Post("/api/ai/chat", permission="ai:chat")
    def chat(self, principal, body: dict):
        return self.chat_service.complete(principal, body)

    @Post("/api/ai/chat/stream", permission="ai:chat", stream=True)
    def stream(self, principal, body: dict):
        return self.chat_service.stream(principal, body)
