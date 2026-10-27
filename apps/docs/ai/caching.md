# Caching in ForgeArc AI

ForgeArc AI includes the same application cache helpers as the Node and Python kits: required TTL, write-path invalidation, stampede mutex (singleflight), and safe defaults for errors and empty results.

The durable PostgreSQL/pgvector store remains the source of truth for jobs, vectors, conversations, usage, agent runs, approvals, and evaluations. Use the cache only to accelerate **read-often / change-rarely** lookups (policy snapshots, allowlists, embedding fingerprints, tenant config), never as a substitute for [durable state](./durable-state).

## Module

```text
products/forgearc-ai/packages/core/src/forgearc_ai/cache.py
```

```python
from forgearc_ai.cache import create_cache

cache = create_cache(ttl_ms=60_000, key_prefix="ai:")
value = cache.get_or_load(
    f"tenant:{tenant_id}:tool-allowlist",
    lambda: load_allowlist(tenant_id),
)
cache.write_and_invalidate(
    f"tenant:{tenant_id}:tool-allowlist",
    lambda: save_allowlist(tenant_id, updated),
)
```

## Configuration

Same `FORGEARC_CACHE_*` knobs as the platform kits (see [Caching patterns](/architecture/caching)):

| Env | Default | Purpose |
| --- | --- | --- |
| `FORGEARC_CACHE_TTL_MS` | `60000` | Required positive TTL |
| `FORGEARC_CACHE_JITTER_RATIO` | `0.1` | Spread hot-key expiry |
| `FORGEARC_CACHE_STAMPEDE_PROTECTION` | `true` | Per-key mutex / coalescing |
| `FORGEARC_CACHE_COALESCE_TIMEOUT_MS` | `5000` | Max wait for owner loader |
| `FORGEARC_CACHE_NEGATIVE` | `false` | Cache empty results |
| `FORGEARC_CACHE_ERRORS` | `false` | Keep off in production |
| `FORGEARC_CACHE_KEY_PREFIX` | _(empty)_ | Prefer `ai:` in this product |

## What not to cache

- Agent run state, pending approvals, or evaluation rows (persist via `PostgresRepository`)
- Raw prompts, secrets, tokens, or full conversation transcripts
- Transient provider errors (leave `FORGEARC_CACHE_ERRORS=false`)

## Related

- [Platform caching patterns](/architecture/caching) — full mistake list and API
- [Durable state](./durable-state) — why the database is required
- [Configuration](./configuration) — runtime and identity settings
