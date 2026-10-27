/**
 * ForgeArc application cache helpers.
 *
 * Standards baked in to avoid common caching mistakes:
 * 1. Every entry requires a positive TTL (no forever-cache by default).
 * 2. Write paths invalidate (or replace) cached keys.
 * 3. Stampede protection via request coalescing (singleflight / mutex).
 * 4. Errors are not cached; empty results use a short optional negative TTL.
 * 5. The cache accelerates reads — the loader/database remains the source of truth.
 */

export type CacheValue = unknown;

export interface CacheEntry<T = CacheValue> {
  value: T;
  expiresAt: number;
  negative?: boolean;
}

export interface CacheStore {
  get<T = CacheValue>(key: string): Promise<CacheEntry<T> | undefined> | CacheEntry<T> | undefined;
  set<T = CacheValue>(key: string, entry: CacheEntry<T>): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  /** Optional prefix delete for invalidate-on-write of related keys. */
  deleteByPrefix?(prefix: string): Promise<number> | number;
  clear?(): Promise<void> | void;
}

export interface CacheOptions {
  /**
   * Required positive TTL in milliseconds.
   * There is no infinite default — unset TTL is a configuration error.
   */
  ttlMs: number;
  /**
   * Fraction of TTL used as random jitter (0–1). Default 0.1 (10%).
   * Spreads expiry of hot keys to reduce stampedes.
   */
  ttlJitterRatio?: number;
  /**
   * When true (default), concurrent misses for the same key share one loader
   * (request coalescing / singleflight mutex).
   */
  stampedeProtection?: boolean;
  /** Max time to wait for a coalesced loader before failing open to a new load. */
  coalesceTimeoutMs?: number;
  /**
   * Cache empty / null / undefined loader results with a short TTL.
   * Default false — empty means "load again next time".
   */
  cacheNegative?: boolean;
  /** TTL for negative entries when cacheNegative is true. Defaults to min(ttlMs, 30s). */
  negativeTtlMs?: number;
  /**
   * Cache thrown errors. Default false — transient failures must not poison the cache.
   * Prefer leaving this off in production.
   */
  cacheErrors?: boolean;
  /** TTL for cached errors when cacheErrors is true. Defaults to min(ttlMs, 5s). */
  errorTtlMs?: number;
  /** Namespace prefix applied to every key. */
  keyPrefix?: string;
  /** Clock for tests. */
  now?: () => number;
  /** Random source for jitter (0–1). */
  random?: () => number;
}

export interface ResolvedCacheOptions {
  ttlMs: number;
  ttlJitterRatio: number;
  stampedeProtection: boolean;
  coalesceTimeoutMs: number;
  cacheNegative: boolean;
  negativeTtlMs: number;
  cacheErrors: boolean;
  errorTtlMs: number;
  keyPrefix: string;
  now: () => number;
  random: () => number;
}

const DEFAULT_NEGATIVE_CAP_MS = 30_000;
const DEFAULT_ERROR_CAP_MS = 5_000;

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve cache options from explicit overrides and FORGEARC_CACHE_* env vars.
 */
export function resolveCacheOptions(overrides: Partial<CacheOptions> & { ttlMs?: number } = {}): ResolvedCacheOptions {
  const ttlMs = overrides.ttlMs ?? parseNumber(process.env.FORGEARC_CACHE_TTL_MS, 60_000);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('Cache TTL must be a positive number of milliseconds (FORGEARC_CACHE_TTL_MS or options.ttlMs)');
  }

  const ttlJitterRatio = clampRatio(
    overrides.ttlJitterRatio ?? parseNumber(process.env.FORGEARC_CACHE_JITTER_RATIO, 0.1)
  );
  const stampedeProtection =
    overrides.stampedeProtection ??
    parseBool(process.env.FORGEARC_CACHE_STAMPEDE_PROTECTION, true);
  const coalesceTimeoutMs =
    overrides.coalesceTimeoutMs ??
    parseNumber(process.env.FORGEARC_CACHE_COALESCE_TIMEOUT_MS, 5_000);
  const cacheNegative =
    overrides.cacheNegative ?? parseBool(process.env.FORGEARC_CACHE_NEGATIVE, false);
  const negativeTtlMs =
    overrides.negativeTtlMs ??
    parseNumber(
      process.env.FORGEARC_CACHE_NEGATIVE_TTL_MS,
      Math.min(ttlMs, DEFAULT_NEGATIVE_CAP_MS)
    );
  const cacheErrors =
    overrides.cacheErrors ?? parseBool(process.env.FORGEARC_CACHE_ERRORS, false);
  const errorTtlMs =
    overrides.errorTtlMs ??
    parseNumber(process.env.FORGEARC_CACHE_ERROR_TTL_MS, Math.min(ttlMs, DEFAULT_ERROR_CAP_MS));
  const keyPrefix =
    overrides.keyPrefix ?? process.env.FORGEARC_CACHE_KEY_PREFIX ?? '';

  return {
    ttlMs,
    ttlJitterRatio,
    stampedeProtection,
    coalesceTimeoutMs: Math.max(1, coalesceTimeoutMs),
    cacheNegative,
    negativeTtlMs: Math.max(1, negativeTtlMs),
    cacheErrors,
    errorTtlMs: Math.max(1, errorTtlMs),
    keyPrefix,
    now: overrides.now ?? (() => Date.now()),
    random: overrides.random ?? Math.random,
  };
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** In-process store suitable for Lambda warm containers and single-instance APIs. */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry>();

  get<T = CacheValue>(key: string): CacheEntry<T> | undefined {
    return this.entries.get(key) as CacheEntry<T> | undefined;
  }

  set<T = CacheValue>(key: string, entry: CacheEntry<T>): void {
    this.entries.set(key, entry as CacheEntry);
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  deleteByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }
}

export class CacheClient {
  private readonly options: ResolvedCacheOptions;
  private readonly store: CacheStore;
  /** Singleflight map: one in-flight loader per key (mutex / request coalescing). */
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(options: CacheOptions, store: CacheStore = new MemoryCacheStore()) {
    this.options = resolveCacheOptions(options);
    this.store = store;
  }

  getOptions(): Readonly<ResolvedCacheOptions> {
    return this.options;
  }

  private fullKey(key: string): string {
    return this.options.keyPrefix ? `${this.options.keyPrefix}${key}` : key;
  }

  /** Apply TTL with optional jitter so hot keys do not expire together. */
  computeExpiry(baseTtlMs: number = this.options.ttlMs): number {
    const jitterWindow = baseTtlMs * this.options.ttlJitterRatio;
    const jitter = jitterWindow > 0 ? (this.options.random() * 2 - 1) * jitterWindow : 0;
    const ttl = Math.max(1, Math.round(baseTtlMs + jitter));
    return this.options.now() + ttl;
  }

  private async readEntry<T = CacheValue>(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = await this.store.get<T>(this.fullKey(key));
    if (!entry) return undefined;
    if (entry.expiresAt <= this.options.now()) {
      await this.store.delete(this.fullKey(key));
      return undefined;
    }
    return entry;
  }

  async get<T = CacheValue>(key: string): Promise<T | undefined> {
    const entry = await this.readEntry<T>(key);
    if (!entry) return undefined;
    if (entry.value instanceof Error) return undefined;
    return entry.value;
  }

  async set<T = CacheValue>(key: string, value: T, ttlMs?: number): Promise<void> {
    await this.store.set(this.fullKey(key), {
      value,
      expiresAt: this.computeExpiry(ttlMs ?? this.options.ttlMs),
    });
  }

  /** Invalidate a single key after a durable write. */
  async invalidate(key: string): Promise<void> {
    await this.store.delete(this.fullKey(key));
  }

  /** Invalidate related keys after a durable write (e.g. tenant:123:). */
  async invalidatePrefix(prefix: string): Promise<number> {
    if (!this.store.deleteByPrefix) {
      throw new Error('Cache store does not support prefix invalidation');
    }
    return this.store.deleteByPrefix(this.fullKey(prefix));
  }

  /**
   * Cache-aside read: return cached value or load from the durable source.
   * Concurrent callers for the same key share one loader when stampedeProtection is on.
   */
  async getOrLoad<T>(key: string, loader: () => Promise<T> | T): Promise<T> {
    const entry = await this.readEntry<T>(key);
    if (entry) {
      if (entry.value instanceof Error) {
        throw entry.value;
      }
      return entry.value;
    }

    if (!this.options.stampedeProtection) {
      return this.loadAndStore(key, loader);
    }

    const full = this.fullKey(key);
    const existing = this.inflight.get(full) as Promise<T> | undefined;
    if (existing) {
      return this.awaitCoalesced(existing);
    }

    const promise = this.loadAndStore(key, loader).finally(() => {
      this.inflight.delete(full);
    });
    this.inflight.set(full, promise);
    return this.awaitCoalesced(promise);
  }

  private async awaitCoalesced<T>(promise: Promise<T>): Promise<T> {
    const timeout = this.options.coalesceTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Cache coalesce timeout after ${timeout}ms`)),
            timeout
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async loadAndStore<T>(key: string, loader: () => Promise<T> | T): Promise<T> {
    try {
      const value = await loader();
      if (value === null || value === undefined) {
        if (this.options.cacheNegative) {
          await this.store.set(this.fullKey(key), {
            value: value as T,
            expiresAt: this.computeExpiry(this.options.negativeTtlMs),
            negative: true,
          });
        }
        return value;
      }
      await this.set(key, value);
      return value;
    } catch (error) {
      if (this.options.cacheErrors) {
        const err = error instanceof Error ? error : new Error(String(error));
        await this.store.set(this.fullKey(key), {
          value: err as T,
          expiresAt: this.computeExpiry(this.options.errorTtlMs),
          negative: true,
        });
      }
      throw error;
    }
  }

  /**
   * Write-path helper: persist via `write`, then invalidate so the next read
   * reloads from the durable store (cache is never the source of truth).
   */
  async writeAndInvalidate<T>(
    key: string,
    write: () => Promise<T> | T,
    options?: { alsoInvalidatePrefix?: string }
  ): Promise<T> {
    const result = await write();
    await this.invalidate(key);
    if (options?.alsoInvalidatePrefix) {
      await this.invalidatePrefix(options.alsoInvalidatePrefix);
    }
    return result;
  }
}

/** Factory with env-aware defaults. */
export function createCache(
  options: CacheOptions = { ttlMs: parseNumber(process.env.FORGEARC_CACHE_TTL_MS, 60_000) },
  store?: CacheStore
): CacheClient {
  return new CacheClient(options, store);
}
