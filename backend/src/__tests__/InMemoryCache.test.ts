import { describe, expect, it, vi } from 'vitest';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';

describe('InMemoryCache stale-while-revalidate', () => {
  it('returns stale immediately and shares one background refresh', async () => {
    let now = 0;
    const cache = new InMemoryCache(() => now);
    let resolveRefresh!: (value: string) => void;
    const compute = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('initial')
      .mockImplementationOnce(
        () => new Promise<string>((resolve) => { resolveRefresh = resolve; }),
      );

    await expect(cache.getOrSetStale('key', 1, 10, compute)).resolves.toBe('initial');
    now = 1_500;

    await expect(cache.getOrSetStale('key', 1, 10, compute)).resolves.toBe('initial');
    await expect(cache.getOrSetStale('key', 1, 10, compute)).resolves.toBe('initial');
    expect(compute).toHaveBeenCalledTimes(2);

    resolveRefresh('refreshed');
    await Promise.resolve();
    await Promise.resolve();

    await expect(cache.getOrSetStale('key', 1, 10, compute)).resolves.toBe('refreshed');
  });

  it('keeps a stale value when the background refresh fails', async () => {
    let now = 0;
    const cache = new InMemoryCache(() => now);
    const compute = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('last-good')
      .mockRejectedValueOnce(new Error('provider unavailable'));

    await cache.getOrSetStale('key', 1, 10, compute);
    now = 2_000;

    await expect(cache.getOrSetStale('key', 1, 10, compute)).resolves.toBe('last-good');
    await Promise.resolve();
    expect(cache.state('key')).toBe('stale');
  });

  it('blocks and recomputes after the stale window expires', async () => {
    let now = 0;
    const cache = new InMemoryCache(() => now);
    const compute = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new');

    await cache.getOrSetStale('key', 1, 2, compute);
    now = 2_001;

    await expect(cache.getOrSetStale('key', 1, 2, compute)).resolves.toBe('new');
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
