import { FlagProvider } from '../../domain/ports/FlagProvider';
import { FlagStatus, FlagRef, FlagProviderId } from '../../domain/entities/Flag';

/**
 * Dispatches flag lookups to the adapter registered for the ref's provider.
 * Beaches carry provider-neutral FlagRefs, so use cases stay unaware of which
 * operators are wired (Cruz Roja today; other regional operators tomorrow).
 * An unknown provider resolves to null: a catalog entry pointing at an
 * unwired provider must degrade like "no coverage", never break the endpoint.
 */
export class FlagProviderRouter implements FlagProvider {
  constructor(private readonly providers: Partial<Record<FlagProviderId, FlagProvider>>) {}

  async getFlag(ref: FlagRef): Promise<FlagStatus | null> {
    const provider = this.providers[ref.provider];
    if (!provider) return null;
    return provider.getFlag(ref);
  }
}
