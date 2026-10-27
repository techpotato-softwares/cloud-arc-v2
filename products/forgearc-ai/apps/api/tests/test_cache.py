import threading
import time

import pytest

from forgearc_ai.cache import (
    CacheClient,
    MemoryCacheStore,
    create_cache,
    resolve_cache_options,
)


def test_requires_positive_ttl():
    with pytest.raises(ValueError, match="positive"):
        resolve_cache_options(ttl_ms=0)


def test_stampede_mutex_coalesces_concurrent_misses():
    loads = {"count": 0}
    cache = create_cache(
        ttl_ms=60_000,
        ttl_jitter_ratio=0,
        stampede_protection=True,
        coalesce_timeout_ms=5_000,
        key_prefix="ai:",
    )
    barrier = threading.Barrier(3)

    def loader():
        loads["count"] += 1
        time.sleep(0.05)
        return {"hot": True}

    results: list[dict] = []
    errors: list[BaseException] = []

    def worker():
        try:
            barrier.wait()
            results.append(cache.get_or_load("tenant:1:policy", loader))
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    assert loads["count"] == 1
    assert all(r == {"hot": True} for r in results)


def test_write_invalidates_so_postgres_remains_source_of_truth():
    cache = create_cache(ttl_ms=60_000, ttl_jitter_ratio=0, key_prefix="ai:")
    cache.set("doc:meta:1", {"title": "v1"})
    written = cache.write_and_invalidate("doc:meta:1", lambda: {"title": "v2"})
    assert written == {"title": "v2"}
    assert cache.get("doc:meta:1") is None


def test_does_not_cache_errors_by_default():
    cache = create_cache(ttl_ms=60_000, ttl_jitter_ratio=0, cache_errors=False)
    attempts = {"count": 0}

    def failing():
        attempts["count"] += 1
        raise RuntimeError("provider 500")

    with pytest.raises(RuntimeError, match="provider 500"):
        cache.get_or_load("x", failing)
    with pytest.raises(RuntimeError, match="provider 500"):
        cache.get_or_load("x", failing)
    assert attempts["count"] == 2


def test_ttl_expiry_with_jitter_disabled():
    clock = {"now": 1000.0}
    cache = CacheClient(
        resolve_cache_options(ttl_ms=100, ttl_jitter_ratio=0),
        MemoryCacheStore(),
        now=lambda: clock["now"],
        random_fn=lambda: 0.5,
    )
    cache.set("embedding:hash", [0.1, 0.2])
    assert cache.get("embedding:hash") == [0.1, 0.2]
    clock["now"] = 1101.0
    assert cache.get("embedding:hash") is None
