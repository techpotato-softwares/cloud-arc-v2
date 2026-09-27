from pydantic import BaseModel
import pytest

from core.validation import validate_route_input
from middleware.error_handler import ValidationError


class LoginLike(BaseModel):
    username: str
    password: str


def test_validate_route_input_accepts_valid_body():
    event = {"body": '{"username":"a","password":"b"}'}
    validate_route_input({"body_schema": LoginLike}, event)
    assert event["_validated_body"]["username"] == "a"


def test_validate_route_input_rejects_invalid_body():
    with pytest.raises(ValidationError):
        validate_route_input({"body_schema": LoginLike}, {"body": '{"username":"a"}'})
