from core.handler_factory import create_lambda_handler
from core.service_registry import define_lambda

from modules.demo.src.controllers.demo_controller import DemoItemController
from modules.demo.src.repositories.demo_item_repository import DemoItemRepository
from modules.demo.src.services.demo_item_service import DemoItemService
from modules.demo.src.types.svc_types import TYPES

define_lambda(
    name="demo",
    controllers=[DemoItemController],
    bindings=[
        {"symbol": TYPES.DemoItemService, "implementation": DemoItemService},
        {"symbol": TYPES.DemoItemRepository, "implementation": DemoItemRepository},
    ],
)
handler = create_lambda_handler("demo")
