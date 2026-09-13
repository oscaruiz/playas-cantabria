import { describe, it, expect } from 'vitest';
import express from 'express';
import { once } from 'events';
import type { AddressInfo } from 'net';
import { createBeachesRouter } from '../infrastructure/express/routes/beachesRouter';
import type { GetAllBeaches } from '../domain/use-cases/GetAllBeaches';
import type { GetBeachById } from '../domain/use-cases/GetBeachById';
import type { GetFeaturedBeaches } from '../domain/use-cases/GetFeaturedBeaches';
import type { LegacyDetailsAssembler } from '../application/services/LegacyDetailsAssembler';

/**
 * The listing and the detail paint THE SAME SKY on two screens one tap apart,
 * so the window a client may keep them for has to be the same. It was not:
 * `/featured` allowed half an hour of stale-while-revalidate against five
 * minutes for `/details`, and the phone's own http cache — which sits below
 * the service worker and is invisible to it — served the front page a sky six
 * times older than the beach behind the card.
 *
 * The number is pinned, but the assertion that matters is the one before it:
 * the two headers are compared to EACH OTHER, because what must not come back
 * is the drift between them. Comparing them alone would pass with both headers
 * missing, hence the literal as well.
 *
 * What this cannot check is everything the drift actually travelled through —
 * the browser's http cache, workbox, an iPhone. Those are exactly the parts
 * the doubles replace.
 */
const vacio = { mejores: [], revisar: [], resumenTodas: [] };

const deps = {
  getAllBeaches: { execute: async () => [] } as unknown as GetAllBeaches,
  getBeachById: { execute: async () => undefined } as unknown as GetBeachById,
  getFeaturedBeaches: { execute: async () => vacio } as unknown as GetFeaturedBeaches,
  legacyDetailsAssembler: { assemble: async () => ({}) } as unknown as LegacyDetailsAssembler,
};

async function cabeceras(): Promise<{
  featured: string | null;
  details: string | null;
  estados: number[];
}> {
  const app = express().use('/api/beaches', createBeachesRouter(deps));
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/beaches`;
  try {
    const [featured, details] = await Promise.all([
      fetch(`${base}/featured`),
      fetch(`${base}/3907990/details`),
    ]);
    return {
      featured: featured.headers.get('cache-control'),
      details: details.headers.get('cache-control'),
      estados: [featured.status, details.status],
    };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

describe('ventana de caché de /featured', () => {
  it('no deja que un cliente guarde el ranking más tiempo que el detalle', async () => {
    const { featured, details, estados } = await cabeceras();

    // A header read off an error page would prove nothing about the contract.
    expect(estados).toEqual([200, 200]);
    expect(featured).toBe(details);
    expect(featured).toBe('public, max-age=60');
  });
});
