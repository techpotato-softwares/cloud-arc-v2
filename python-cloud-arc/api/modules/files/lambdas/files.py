from core.service_registry import define_lambda
from core.handler_factory import create_lambda_handler
from modules.files.src.controllers.files_controller import FilesController
from modules.files.src.services.files_service import FilesService
from modules.files.src.types.svc_types import TYPES

define_lambda(
    name="files",
    controllers=[FilesController],
    bindings=[{"symbol": TYPES.FilesService, "implementation": FilesService}],
)
handler = create_lambda_handler("files")
