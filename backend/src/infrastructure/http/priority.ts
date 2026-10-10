import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Whether the outgoing calls of the current async flow have a user waiting.
 *
 * Background work (a stale cache refresh, the Cruz Roja rescue sweep) shares the
 * per-host limits with the requests a user is waiting on. Without telling them
 * apart, one ranking refresh (a call per beach) filled OpenWeather's 50/min and
 * a /details opened right after it queued behind the refresh past the 15 s
 * request timeout: 504 in production on 10-oct-2026. `HostLimiter` serves the
 * waited-for calls first and keeps part of each rate cap out of the background's
 * reach.
 *
 * A ticket and not a flag, so it can be promoted: when a user ends up waiting
 * on work that started in the background (a cache miss joining an in-flight
 * refresh), the cache promotes that ticket, and every call under it, including
 * nested computes, stops yielding.
 */
export class Ticket {
  private waitedFor = false;
  /** Work this one started, or work it is waiting on that someone else started. */
  private readonly dependencies = new Set<Ticket>();

  /** `parent`: the background work this one was started from, if any. */
  constructor(private readonly parent?: Ticket) {
    parent?.dependencies.add(this);
  }

  get background(): boolean {
    return !this.waitedFor && (this.parent?.background ?? true);
  }

  /**
   * Records that this work is waiting on `other`, a compute someone else
   * started. Promoting this one later must reach it: a detail refresh that
   * joined the ranking's OpenWeather call stayed behind the ranking after a
   * user came to wait on the detail (found by Codex, 10-oct-2026).
   */
  waitOn(other: Ticket): void {
    if (other === this) return;
    this.dependencies.add(other);
    if (!this.background) other.promote();
  }

  promote(): void {
    if (this.waitedFor) return;
    this.waitedFor = true;
    this.dependencies.forEach((d) => d.promote());
  }
}

const storage = new AsyncLocalStorage<Ticket>();

export function currentTicket(): Ticket | undefined {
  return storage.getStore();
}

export function inBackground(): boolean {
  return currentTicket()?.background === true;
}

/** Runs `fn` under `ticket`: every outgoing call it makes carries it. */
export function runWithTicket<T>(ticket: Ticket, fn: () => Promise<T>): Promise<T> {
  return storage.run(ticket, fn);
}

/** Runs `fn` as work nobody waits for. */
export function runInBackground<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTicket(new Ticket(), fn);
}
