import { describe, expect, it, vi } from 'vitest';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { currentTicket, inBackground, type Ticket } from '../infrastructure/http/priority';

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

describe('InMemoryCache priority of background work', () => {
  it('runs the stale refresh as background work, and a plain miss as waited-for', async () => {
    let now = 0;
    const cache = new InMemoryCache(() => now);
    const seen: boolean[] = [];
    const compute = async () => { seen.push(inBackground()); return 'v'; };

    await cache.getOrSetStale('key', 1, 10, compute);
    now = 1_500;
    await cache.getOrSetStale('key', 1, 10, compute);
    await new Promise((r) => setTimeout(r, 0));

    expect(seen).toEqual([false, true]);
  });

  it('a miss computed inside background work is background too', async () => {
    let now = 0;
    const cache = new InMemoryCache(() => now);
    let nested: boolean | null = null;
    const outer = async () => {
      await cache.getOrSet('inner', 60, async () => { nested = inBackground(); return 1; });
      return 'v';
    };

    await cache.getOrSetStale('outer', 1, 10, async () => 'v0');
    now = 1_500;
    await cache.getOrSetStale('outer', 1, 10, outer);
    await new Promise((r) => setTimeout(r, 0));

    expect(nested).toBe(true);
  });

  it('a user waiting on a background compute promotes it', async () => {
    let now = 0;
    const cache = new InMemoryCache(() => now);
    let release!: () => void;
    let ticket: Ticket | undefined;
    const inner = () => new Promise<number>((resolve) => {
      ticket = currentTicket();
      release = () => resolve(1);
    });

    // A background refresh starts computing 'inner' as a miss...
    await cache.getOrSetStale('outer', 1, 10, async () => 'v0');
    now = 1_500;
    await cache.getOrSetStale('outer', 1, 10, () => cache.getOrSet('inner', 60, inner).then(() => 'v1'));
    await new Promise((r) => setTimeout(r, 0));
    expect(ticket?.background).toBe(true);

    // ...and a request needs that same key: it joins and promotes it.
    const waiting = cache.getOrSet('inner', 60, inner);
    expect(ticket?.background).toBe(false);
    release();
    await expect(waiting).resolves.toBe(1);
  });

  it('promoting work reaches the compute it joined, started by other background work', async () => {
    let now = 0;
    const cache = new InMemoryCache(() => now);
    let release!: () => void;
    let sharedTicket: Ticket | undefined;
    const sharedCall = () => new Promise<number>((resolve) => {
      sharedTicket = currentTicket();
      release = () => resolve(1);
    });

    // The ranking's refresh starts the shared call as background work...
    await cache.getOrSetStale('ranking', 1, 10, async () => 'r0');
    await cache.getOrSetStale('detail', 1, 2, async () => 'd0');
    now = 1_500;
    await cache.getOrSetStale('ranking', 1, 10, () => cache.getOrSet('ow', 60, sharedCall).then(() => 'r1'));
    await new Promise((r) => setTimeout(r, 0));
    // ...the detail's own refresh joins it, still background...
    await cache.getOrSetStale('detail', 1, 2, () => cache.getOrSet('ow', 60, sharedCall).then(() => 'd1'));
    await new Promise((r) => setTimeout(r, 0));
    expect(sharedTicket?.background).toBe(true);

    // ...and a user who now has to wait for the detail lifts the shared call too.
    now = 2_500;
    const waiting = cache.getOrSetStale('detail', 1, 2, async () => 'never');
    expect(sharedTicket?.background).toBe(false);
    release();
    await expect(waiting).resolves.toBe('d1');
  });
});
