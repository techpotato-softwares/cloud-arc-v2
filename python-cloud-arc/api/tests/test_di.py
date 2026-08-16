from core.di import Container, Inject, injectable


def test_container_injects_constructor_deps():
    TYPES_FOO = "Foo"
    TYPES_BAR = "Bar"

    @injectable
    class Bar:
        def ping(self):
            return "pong"

    @injectable
    class Foo:
        def __init__(self, bar: Bar = Inject(TYPES_BAR)):
            self.bar = bar

    container = Container()
    container.bind(TYPES_BAR, Bar)
    container.bind(TYPES_FOO, Foo)
    foo = container.get(TYPES_FOO)
    assert foo.bar.ping() == "pong"
    assert container.get(TYPES_FOO) is foo


def test_controller_resolved_from_bindings():
    from modules.demo.src.controllers.demo_controller import DemoItemController
    from modules.demo.src.services.demo_item_service import DemoItemService
    from modules.demo.src.repositories.demo_item_repository import DemoItemRepository
    from modules.demo.src.types.svc_types import TYPES
    from core.di import SESSION_FACTORY

    calls = {"n": 0}

    def fake_session():
        calls["n"] += 1
        raise AssertionError("session should not open in this test")

    container = Container()
    container.bind_constant(SESSION_FACTORY, fake_session)
    container.bind(TYPES.DemoItemService, DemoItemService)
    container.bind(TYPES.DemoItemRepository, DemoItemRepository)
    ctrl = container.resolve(DemoItemController)
    assert ctrl.service is not None
    assert ctrl.service.repo is not None
