# ForgeArc Demo Module (Python)

Sample CRUD (`/api/demo/items`) that demonstrates Controller → Service → Repository,
constructor `Inject(TYPES.…)`, `@RequirePermission`, `@RequireModule("demo")`, and paginated lists.

| Layer | File |
|-------|------|
| Lambda bindings | `lambdas/demo.py` |
| TYPES | `src/types/svc_types.py` |
| Controller | `src/controllers/demo_controller.py` |
| Service | `src/services/demo_item_service.py` |
| Repository | `src/repositories/demo_item_repository.py` |
| Schemas | `src/schemas/demo.py` |

Use this as the template when adding your own sellable modules. Full guide: [docs/CSR-AND-DI.md](../../../docs/CSR-AND-DI.md).
