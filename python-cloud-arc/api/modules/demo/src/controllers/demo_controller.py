from __future__ import annotations

from decorators import Controller, Get, Post, Put, Delete
from decorators.auth_decorators import RequirePermission, RequireModule
from core.di import Inject, injectable
from core.openapi import ApiBody
from core.pagination import parse_list_query
from middleware.error_handler import create_success_response
from modules.demo.src.schemas.demo import CreateDemoItemRequest, UpdateDemoItemRequest
from modules.demo.src.services.demo_item_service import IDemoItemService
from modules.demo.src.types.svc_types import TYPES


@Controller(path="/api/demo/items", lambda_name="demo")
@injectable
class DemoItemController:
    def __init__(self, service: IDemoItemService = Inject(TYPES.DemoItemService)):
        self.service = service

    @Post("/")
    @RequireModule("demo")
    @RequirePermission("demo:write", "admin")
    @ApiBody(CreateDemoItemRequest)
    def create(self, data: dict, user=None):
        user = user or {}
        item = self.service.create(data or {}, user.get("userId"), user.get("tenantId"))
        return create_success_response(item, 201)

    @Get("/")
    @RequireModule("demo")
    @RequirePermission("demo:read", "admin")
    def list(self, user=None, event=None):
        params = parse_list_query((event or {}).get("queryStringParameters"))
        result = self.service.list((user or {}).get("tenantId"), params)
        return create_success_response(result)

    @Get("/{id}")
    @RequireModule("demo")
    @RequirePermission("demo:read", "admin")
    def get(self, id: str):
        return create_success_response(self.service.get(int(id)))

    @Put("/{id}")
    @RequireModule("demo")
    @RequirePermission("demo:write", "admin")
    @ApiBody(UpdateDemoItemRequest)
    def update(self, id: str, data: dict, user=None):
        item = self.service.update(int(id), data or {}, (user or {}).get("userId"))
        return create_success_response(item)

    @Delete("/{id}")
    @RequireModule("demo")
    @RequirePermission("demo:write", "admin")
    def remove(self, id: str):
        self.service.remove(int(id))
        return create_success_response({"deleted": True})
