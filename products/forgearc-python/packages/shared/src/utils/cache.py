"""ForgeArc application cache helpers.

Standards baked in to avoid common caching mistakes:
1. Every entry requires a positive TTL (no forever-cache by default).
2. Write paths invalidate (or replace) cached keys.
3. Stampede protection via request coalescing (singleflight / mutex).
4. Errors are not cached; empty results use a short optional negative TTL.
5. The cache accelerates reads — the loader/database remains the source of truth.
"""

from __future__ import annotations

import os
import random
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Protocol

DEFAULT_NEGATIVE_CAP_MS = 30_000
DEFAULT_ERROR_CAP_MS = 5_000


def _parse_bool(value: str | None, fallback: bool) -> bool:
    if value is None or value == "":
        return fallback
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_number(value: str | None, fallback: float) -> float:
    if value is None or value == "":
        return fallback
    try:
        return float(value)
    except ValueError:
        return fallback


def _clamp_ratio(value: float) -> float:
    if value < 0:
        return 0.0
    if value > 1:
        return 1.0
    return value


@dataclass(frozen=True)
class CacheEntry:
    value: Any
    expires_at: float
    negative: bool = False


@dataclass(frozen=True)
class CacheOptions:
    """Resolved cache configuration (explicit + FORGEARC_CACHE_* env)."""

    ttl_ms: float
    ttl_jitter_ratio: float = 0.1
    stampede_protection: bool = True
    coalesce_timeout_ms: float = 5_000
    cache_negative: bool = False
    negative_ttl_ms: float = DEFAULT_NEGATIVE_CAP_MS
    cache_errors: bool = False
    error_ttl_ms: float = DEFAULT_ERROR_CAP_MS
    key_prefix: str = ""


class CacheStore(Protocol):
    def get(self, key: str) -> CacheEntry | None: ...

    def set(self, key: str, entry: CacheEntry) -> None: ...

    def delete(self, key: str) -> None: ...

    def delete_by_prefix(self, prefix: str) -> int: ...

    def clear(self) -> None: ...


class MemoryCacheStore:
    """In-process store for warm Lambda containers and single-instance APIs."""

    def __init__(self) -> None:
        self._entries: dict[str, CacheEntry] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> CacheEntry | None:
        with self._lock:
            return self._entries.get(key)

    def set(self, key: str, entry: CacheEntry) -> None:
        with self._lock:
            self._entries[key] = entry

    def delete(self, key: str) -> None:
        with self._lock:
            self._entries.pop(key, None)

    def delete_by_prefix(self, prefix: str) -> int:
        with self._lock:
            keys = [k for k in self._entries if k.startswith(prefix)]
            for key in keys:
                del self._entries[key]
            return len(keys)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def size(self) -> int:
        with self._lock:
            return len(self._entries)


def resolve_cache_options(
    *,
    ttl_ms: float | None = None,
    ttl_jitter_ratio: float | None = None,
    stampede_protection: bool | None = None,
    coalesce_timeout_ms: float | None = None,
    cache_negative: bool | None = None,
    negative_ttl_ms: float | None = None,
    cache_errors: bool | None = None,
    error_ttl_ms: float | None = None,
    key_prefix: str | None = None,
) -> CacheOptions:
    resolved_ttl = ttl_ms if ttl_ms is not None else _parse_number(
        os.environ.get("FORGEARC_CACHE_TTL_MS"), 60_000
    )
    if resolved_ttl <= 0:
        raise ValueError(
            "Cache TTL must be a positive number of milliseconds "
            "(FORGEARC_CACHE_TTL_MS or ttl_ms)"
        )

    jitter = (
        ttl_jitter_ratio
        if ttl_jitter_ratio is not None
        else _parse_number(os.environ.get("FORGEARC_CACHE_JITTER_RATIO"), 0.1)
    )
    stampede = (
        stampede_protection
        if stampede_protection is not None
        else _parse_bool(os.environ.get("FORGEARC_CACHE_STAMPEDE_PROTECTION"), True)
    )
    coalesce = (
        coalesce_timeout_ms
        if coalesce_timeout_ms is not None
        else _parse_number(os.environ.get("FORGEARC_CACHE_COALESCE_TIMEOUT_MS"), 5_000)
    )
    negative = (
        cache_negative
        if cache_negative is not None
        else _parse_bool(os.environ.get("FORGEARC_CACHE_NEGATIVE"), False)
    )
    neg_ttl = (
        negative_ttl_ms
        if negative_ttl_ms is not None
        else _parse_number(
            os.environ.get("FORGEARC_CACHE_NEGATIVE_TTL_MS"),
            min(resolved_ttl, DEFAULT_NEGATIVE_CAP_MS),
        )
    )
    errors = (
        cache_errors
        if cache_errors is not None
        else _parse_bool(os.environ.get("FORGEARC_CACHE_ERRORS"), False)
    )
    err_ttl = (
        error_ttl_ms
        if error_ttl_ms is not None
        else _parse_number(
            os.environ.get("FORGEARC_CACHE_ERROR_TTL_MS"),
            min(resolved_ttl, DEFAULT_ERROR_CAP_MS),
        )
    )
    prefix = (
        key_prefix
        if key_prefix is not None
        else os.environ.get("FORGEARC_CACHE_KEY_PREFIX", "")
    )

    return CacheOptions(
        ttl_ms=resolved_ttl,
        ttl_jitter_ratio=_clamp_ratio(jitter),
        stampede_protection=stampede,
        coalesce_timeout_ms=max(1.0, coalesce),
        cache_negative=negative,
        negative_ttl_ms=max(1.0, neg_ttl),
        cache_errors=errors,
        error_ttl_ms=max(1.0, err_ttl),
        key_prefix=prefix or "",
    )


class _InflightSlot:
    """Mutex + shared result for request coalescing (singleflight)."""

    def __init__(self) -> None:
        self.event = threading.Event()
        self.result: Any = None
        self.error: BaseException | None = None
        self.owner = False


class CacheClient:
    def __init__(
        self,
        options: CacheOptions | None = None,
        store: CacheStore | None = None,
        *,
        now: Callable[[], float] | None = None,
        random_fn: Callable[[], float] | None = None,
    ) -> None:
        self.options = options or resolve_cache_options()
        self.store: CacheStore = store or MemoryCacheStore()
        self._now = now or (lambda: time.time() * 1000)
        self._random = random_fn or random.random
        self._inflight: dict[str, _InflightSlot] = {}
        self._inflight_lock = threading.Lock()

    def _full_key(self, key: str) -> str:
        return f"{self.options.key_prefix}{key}" if self.options.key_prefix else key

    def compute_expiry(self, base_ttl_ms: float | None = None) -> float:
        base = self.options.ttl_ms if base_ttl_ms is None else base_ttl_ms
        jitter_window = base * self.options.ttl_jitter_ratio
        jitter = (self._random() * 2 - 1) * jitter_window if jitter_window > 0 else 0.0
        ttl = max(1.0, base + jitter)
        return self._now() + ttl

    def _read_entry(self, key: str) -> CacheEntry | None:
        entry = self.store.get(self._full_key(key))
        if entry is None:
            return None
        if entry.expires_at <= self._now():
            self.store.delete(self._full_key(key))
            return None
        return entry

    def get(self, key: str) -> Any:
        entry = self._read_entry(key)
        if entry is None:
            return None
        if isinstance(entry.value, BaseException):
            return None
        return entry.value

    def set(self, key: str, value: Any, ttl_ms: float | None = None) -> None:
        self.store.set(
            self._full_key(key),
            CacheEntry(value=value, expires_at=self.compute_expiry(ttl_ms)),
        )

    def invalidate(self, key: str) -> None:
        self.store.delete(self._full_key(key))

    def invalidate_prefix(self, prefix: str) -> int:
        return self.store.delete_by_prefix(self._full_key(prefix))

    def get_or_load(self, key: str, loader: Callable[[], Any]) -> Any:
        entry = self._read_entry(key)
        if entry is not None:
            if isinstance(entry.value, BaseException):
                raise entry.value
            return entry.value

        if not self.options.stampede_protection:
            return self._load_and_store(key, loader)

        full = self._full_key(key)
        with self._inflight_lock:
            slot = self._inflight.get(full)
            if slot is None:
                slot = _InflightSlot()
                slot.owner = True
                self._inflight[full] = slot
            else:
                slot.owner = False

        if not slot.owner:
            finished = slot.event.wait(timeout=self.options.coalesce_timeout_ms / 1000)
            if not finished:
                # Fail open: run our own load rather than hang forever.
                return self._load_and_store(key, loader)
            if slot.error is not None:
                raise slot.error
            return slot.result

        try:
            result = self._load_and_store(key, loader)
            slot.result = result
            return result
        except BaseException as exc:
            slot.error = exc
            raise
        finally:
            slot.event.set()
            with self._inflight_lock:
                self._inflight.pop(full, None)

    def _load_and_store(self, key: str, loader: Callable[[], Any]) -> Any:
        try:
            value = loader()
            if value is None:
                if self.options.cache_negative:
                    self.store.set(
                        self._full_key(key),
                        CacheEntry(
                            value=value,
                            expires_at=self.compute_expiry(self.options.negative_ttl_ms),
                            negative=True,
                        ),
                    )
                return value
            self.set(key, value)
            return value
        except BaseException as exc:
            if self.options.cache_errors:
                # Short TTL poison pill so stampedes do not hammer a failing dependency.
                # Prefer cache_errors=False so transient 5xx never hide recovery.
                self.store.set(
                    self._full_key(key),
                    CacheEntry(
                        value=exc,
                        expires_at=self.compute_expiry(self.options.error_ttl_ms),
                        negative=True,
                    ),
                )
            raise

    def write_and_invalidate(
        self,
        key: str,
        write: Callable[[], Any],
        *,
        also_invalidate_prefix: str | None = None,
    ) -> Any:
        """Persist via write, then invalidate so the next read hits the durable store."""
        result = write()
        self.invalidate(key)
        if also_invalidate_prefix is not None:
            self.invalidate_prefix(also_invalidate_prefix)
        return result


def create_cache(
    *,
    ttl_ms: float | None = None,
    store: CacheStore | None = None,
    **kwargs: Any,
) -> CacheClient:
    options = resolve_cache_options(ttl_ms=ttl_ms, **kwargs)
    return CacheClient(options=options, store=store)
