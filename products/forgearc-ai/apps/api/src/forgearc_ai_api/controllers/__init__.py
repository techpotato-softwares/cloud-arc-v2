"""Import every controller once so decorators register all API routes."""

from .agent_controller import AgentController
from .approval_controller import ApprovalController
from .auth_controller import AuthController
from .chat_controller import ChatController
from .decision_controller import DecisionController
from .document_controller import DocumentController
from .evaluation_controller import EvaluationController
from .job_controller import JobController
from .usage_controller import UsageController

__all__ = [
    "AgentController",
    "ApprovalController",
    "AuthController",
    "ChatController",
    "DecisionController",
    "DocumentController",
    "EvaluationController",
    "JobController",
    "UsageController",
]
