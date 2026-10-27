import threading
import time

import pytest

from utils.cache import (
    CacheClient,
    MemoryCacheStore,
    create_cache,
    resolve_cache_options,
)


def test_requires_positive_ttl():
    with pytest.raises(ValueError, match="positive"):
        resolve_cache_options(ttl_ms=0)
    with pytest.raises(ValueError, match="positive"):
        resolve_cache_options(ttl_ms=-5)


def test_resolves_env_options(monkeypatch):
    monkeypatch.setenv("FORGEARC_CACHE_TTL_MS", "120000")
    monkeypatch.setenv("FORGEARC_CACHE_JITTER_RATIO", "0.2")
    monkeypatch.setenv("FORGEARC_CACHE_STAMPEDE_PROTECTION", "true")
    monkeypatch.setenv("FORGEARC_CACHE_COALESCE_TIMEOUT_MS", "2500")
    monkeypatch.setenv("FORGEARC_CACHE_NEGATIVE", "true")
    monkeypatch.setenv("FORGEARC_CACHE_NEGATIVE_TTL_MS", "1000")
    monkeypatch.setenv("FORGEARC_CACHE_ERRORS", "false")
    monkeypatch.setenv("FORGEARC_CACHE_KEY_PREFIX", "demo:")

    opts = resolve_cache_options()
    assert opts.ttl_ms == 120000
    assert opts.ttl_jitter_ratio == 0.2
    assert opts.stampede_protection is True
    assert opts.coalesce_timeout_ms == 2500
    assert opts.cache_negative is True
    assert opts.negative_ttl_ms == 1000
    assert opts.cache_errors is False
    assert opts.key_prefix == "demo:"


def test_ttl_expiry():
    clock = {"now": 1000.0}

    cache = CacheClient(
        resolve_cache_options(ttl_ms=100, ttl_jitter_ratio=0),
        MemoryCacheStore(),
        now=lambda: clock["now"],
        random_fn=lambda: 0.5,
    )
    cache.set("product", {"version": 1})
    assert cache.get("product") == {"version": 1}
    clock["now"] = 1101.0
    assert cache.get("product") is None


def test_write_and_invalidate():
    cache = create_cache(ttl_ms=60_000, ttl_jitter_ratio=0)
    cache.set("product:1", {"name": "v1"})
    written = cache.write_and_invalidate("product:1", lambda: {"name": "v2"})
    assert written == {"name": "v2"}
    assert cache.get("product:1") is None


def test_stampede_mutex_coalesces_concurrent_misses():
    loads = {"count": 0}
    cache = create_cache(
        ttl_ms=60_000,
        ttl_jitter_ratio=0,
        stampede_protection=True,
        coalesce_timeout_ms=5_000,
    )
    barrier = threading.Barrier(3)

    def loader():
        loads["count"] += 1
        time.sleep(0.05)
        return {"hot": True}

    results = []
    errors = []

    def worker():
        try:
            barrier.wait()
            results.append(cache.get_or_load("hot-key", loader))
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    assert loads["count"] == 1
    assert all(r == {"hot": True} for r in results)


def test_does_not_cache_errors_by_default():
    cache = create_cache(ttl_ms=60_000, ttl_jitter_ratio=0, cache_errors=False)
    attempts = {"count": 0}

    def failing():
        attempts["count"] += 1
        raise RuntimeError("db 500")

    with pytest.raises(RuntimeError, match="db 500"):
        cache.get_or_load("x", failing)
    with pytest.raises(RuntimeError, match="db 500"):
        cache.get_or_load("x", failing)
    assert attempts["count"] == 2


def test_negative_cache_short_ttl():
    clock = {"now": 1000.0}
    loads = {"count": 0}
    cache = CacheClient(
        resolve_cache_options(
            ttl_ms=60_000,
            ttl_jitter_ratio=0,
            cache_negative=True,
            negative_ttl_ms=100,
        ),
        MemoryCacheStore(),
        now=lambda: clock["now"],
        random_fn=lambda: 0.5,
    )

    def empty():
        loads["count"] += 1
        return None

    assert cache.get_or_load("missing", empty) is None
    assert cache.get_or_load("missing", empty) is None
    assert loads["count"] == 1
    clock["now"] = 1101.0
    assert cache.get_or_load("missing", empty) is None
    assert loads["count"] == 2
