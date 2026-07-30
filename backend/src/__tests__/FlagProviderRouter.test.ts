import { describe, it, expect, vi } from 'vitest';
import { FlagProviderRouter } from '../infrastructure/providers/FlagProviderRouter';
import type { FlagProvider } from '../domain/ports/FlagProvider';
import type { FlagStatus, FlagRef } from '../domain/entities/Flag';

const GREEN: FlagStatus = { color: 'green', timestamp: 1 };

describe('FlagProviderRouter', () => {
  it('dispatches to the provider registered for the ref', async () => {
    const cruzroja: FlagProvider = { getFlag: async () => GREEN };
    const spy = vi.spyOn(cruzroja, 'getFlag');
    const router = new FlagProviderRouter({ cruzroja });

    const ref: FlagRef = { provider: 'cruzroja', ref: 373 };
    expect(await router.getFlag(ref)).toEqual(GREEN);
    expect(spy).toHaveBeenCalledWith(ref);
  });

  it('resolves to null for an unwired provider (degrades like "no coverage")', async () => {
    const router = new FlagProviderRouter({});
    expect(await router.getFlag({ provider: 'cruzroja', ref: 373 })).toBeNull();
  });

  it('propagates provider errors (the use cases already catch them)', async () => {
    const failing: FlagProvider = {
      getFlag: async () => {
        throw new Error('hard failure');
      },
    };
    const router = new FlagProviderRouter({ cruzroja: failing });
    await expect(router.getFlag({ provider: 'cruzroja', ref: 1 })).rejects.toThrow('hard failure');
  });
});
