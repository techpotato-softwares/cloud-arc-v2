from pydantic import BaseModel


class CreateDemoItemRequest(BaseModel):
    title: str
    description: str | None = None
    status: str | None = "active"


class UpdateDemoItemRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
