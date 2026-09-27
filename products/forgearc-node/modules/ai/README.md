# @forgearc/module-ai

| | |
|---|---|
| **SKU** | `ai` |
| **Compute** | Lambda (`ai`) |
| **Requires** | platform |
| **CSR** | `AiController` → `AiService` (providers behind the service) |

`POST /api/ai/chat` with `@RequireModule('ai')` and `@RequirePermission('ai:chat', 'admin')`.

Set `AI_PROVIDER=stub|openai|bedrock` plus provider credentials in env / Secrets Manager — never in code.

Pattern: [docs/CSR-AND-DI.md](../../../docs/CSR-AND-DI.md).
