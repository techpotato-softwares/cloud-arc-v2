import {
  CacheClient,
  MemoryCacheStore,
  createCache,
  resolveCacheOptions,
} from '../cache';

describe('ForgeArc cache patterns', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('requires a positive TTL (no forever-cache)', () => {
    expect(() => resolveCacheOptions({ ttlMs: 0 })).toThrow(/positive/);
    expect(() => resolveCacheOptions({ ttlMs: -1 })).toThrow(/positive/);
  });

  it('resolves configurable options from env', () => {
    process.env.FORGEARC_CACHE_TTL_MS = '120000';
    process.env.FORGEARC_CACHE_JITTER_RATIO = '0.2';
    process.env.FORGEARC_CACHE_STAMPEDE_PROTECTION = 'true';
    process.env.FORGEARC_CACHE_COALESCE_TIMEOUT_MS = '2500';
    process.env.FORGEARC_CACHE_NEGATIVE = 'true';
    process.env.FORGEARC_CACHE_NEGATIVE_TTL_MS = '1000';
    process.env.FORGEARC_CACHE_ERRORS = 'false';
    process.env.FORGEARC_CACHE_KEY_PREFIX = 'demo:';

    const opts = resolveCacheOptions();
    expect(opts.ttlMs).toBe(120000);
    expect(opts.ttlJitterRatio).toBe(0.2);
    expect(opts.stampedeProtection).toBe(true);
    expect(opts.coalesceTimeoutMs).toBe(2500);
    expect(opts.cacheNegative).toBe(true);
    expect(opts.negativeTtlMs).toBe(1000);
    expect(opts.cacheErrors).toBe(false);
    expect(opts.keyPrefix).toBe('demo:');
  });

  it('expires entries after TTL', async () => {
    let now = 1_000;
    const cache = new CacheClient(
      { ttlMs: 100, ttlJitterRatio: 0, now: () => now, random: () => 0.5 },
      new MemoryCacheStore()
    );
    await cache.set('product', { version: 1 });
    expect(await cache.get('product')).toEqual({ version: 1 });
    now += 101;
    expect(await cache.get('product')).toBeUndefined();
  });

  it('invalidates on write path so cache is never source of truth', async () => {
    const cache = createCache({ ttlMs: 60_000, ttlJitterRatio: 0 });
    await cache.set('product:1', { name: 'v1' });
    const written = await cache.writeAndInvalidate('product:1', async () => ({ name: 'v2' }));
    expect(written).toEqual({ name: 'v2' });
    expect(await cache.get('product:1')).toBeUndefined();
  });

  it('coalesces concurrent misses with stampede mutex (singleflight)', async () => {
    let loads = 0;
    const cache = createCache({
      ttlMs: 60_000,
      ttlJitterRatio: 0,
      stampedeProtection: true,
      coalesceTimeoutMs: 5_000,
    });

    const loader = async () => {
      loads += 1;
      await new Promise((r) => setTimeout(r, 50));
      return { hot: true };
    };

    const results = await Promise.all([
      cache.getOrLoad('hot-key', loader),
      cache.getOrLoad('hot-key', loader),
      cache.getOrLoad('hot-key', loader),
    ]);

    expect(loads).toBe(1);
    expect(results.every((r) => r.hot === true)).toBe(true);
  });

  it('does not cache transient errors by default', async () => {
    const cache = createCache({ ttlMs: 60_000, ttlJitterRatio: 0, cacheErrors: false });
    let attempts = 0;
    const failing = async () => {
      attempts += 1;
      throw new Error('db 500');
    };

    await expect(cache.getOrLoad('x', failing)).rejects.toThrow('db 500');
    await expect(cache.getOrLoad('x', failing)).rejects.toThrow('db 500');
    expect(attempts).toBe(2);
  });

  it('optionally caches empty results with a short negative TTL', async () => {
    let now = 1_000;
    let loads = 0;
    const cache = new CacheClient(
      {
        ttlMs: 60_000,
        ttlJitterRatio: 0,
        cacheNegative: true,
        negativeTtlMs: 100,
        now: () => now,
        random: () => 0.5,
      },
      new MemoryCacheStore()
    );

    const empty = async () => {
      loads += 1;
      return null;
    };

    expect(await cache.getOrLoad('missing', empty)).toBeNull();
    expect(await cache.getOrLoad('missing', empty)).toBeNull();
    expect(loads).toBe(1);
    now += 101;
    expect(await cache.getOrLoad('missing', empty)).toBeNull();
    expect(loads).toBe(2);
  });

  it('applies TTL jitter so hot keys do not share one expiry', () => {
    const cache = new CacheClient(
      { ttlMs: 1000, ttlJitterRatio: 0.1, now: () => 0, random: () => 1 },
      new MemoryCacheStore()
    );
    // random=1 => +10% jitter
    expect(cache.computeExpiry()).toBe(1100);
  });
});
