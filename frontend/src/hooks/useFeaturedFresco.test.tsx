import React from 'react';
import { render, act } from '@testing-library/react';
import { useFeaturedFresco } from './useFeaturedFresco';
import { MENSAJE_API_ACTUALIZADA } from './useRefrescoDelServiceWorker';
import { FeaturedBeachesResponse, getFeaturedBeaches } from '../services/api';

/** Same fake container as `useRefrescoDelServiceWorker.test`: jsdom has none. */
const canal = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: canal, configurable: true });
});

function emitir(datos: unknown, url = 'https://api.example/api/cantabria/beaches/featured') {
  act(() => {
    const evento = new Event('message') as Event & { data?: unknown };
    evento.data = { type: MENSAJE_API_ACTUALIZADA, url, datos };
    canal.dispatchEvent(evento);
  });
}

/**
 * The rankings are told apart by `timestamp`, which is also what orders the
 * two writers of the cache. Each case picks instants ABOVE the ones the
 * previous case left in place, because that cache is module state and does not
 * reset between tests — the same way it does not reset between two pages of
 * the app, which is the whole point of the fix.
 */
function ranking(
  timestamp: number,
  cielo: string,
  servidoEn?: number,
): FeaturedBeachesResponse {
  return {
    timestamp,
    servidoEn,
    playas: [],
    revisar: [],
    resumenTodas: [{ codigo: '1', descripcionClima: cielo }],
  } as unknown as FeaturedBeachesResponse;
}

/** Resolves the pending `fetch` on demand, to control who finishes first. */
function fetchControlado(): (cuerpo: FeaturedBeachesResponse) => Promise<void> {
  let resolver: (r: unknown) => void = () => undefined;
  global.fetch = jest.fn(
    () => new Promise((r) => { resolver = r; }),
  ) as unknown as typeof fetch;
  return async (cuerpo) => {
    await act(async () => {
      resolver({ ok: true, json: async () => cuerpo });
    });
  };
}

const Sonda: React.FC<{ alLlegar: (r: FeaturedBeachesResponse) => void }> = ({ alLlegar }) => {
  useFeaturedFresco(alLlegar);
  return null;
};

describe('useFeaturedFresco', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(
      new Error('no debería pedirse'),
    ) as unknown as typeof fetch;
  });

  it('entrega el ranking que llegó tarde', () => {
    const alLlegar = jest.fn();
    render(<Sonda alLlegar={alLlegar} />);

    const nuevo = ranking(1000, 'cielo claro');
    emitir(nuevo);

    expect(alLlegar).toHaveBeenCalledWith(nuevo);
  });

  it('sustituye el ranking anterior en la caché que leen las demás pantallas', async () => {
    render(<Sonda alLlegar={jest.fn()} />);

    emitir(ranking(2000, 'nubes'));
    const nuevo = ranking(2001, 'cielo claro');
    emitir(nuevo);

    // Writing only into an EMPTY cache would have passed before this case:
    // what the map re-read on the next tab change was still the old sky.
    await expect(getFeaturedBeaches()).resolves.toEqual(nuevo);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('no deja que un mensaje atrasado pise el ranking ya servido', async () => {
    const alLlegar = jest.fn();
    render(<Sonda alLlegar={alLlegar} />);

    const nuevo = ranking(3001, 'cielo claro');
    emitir(nuevo);
    emitir(ranking(3000, 'nubes'));

    // Both the cache and the repaint: handing the page the discarded body
    // would be the same flicker back, one screen at a time.
    expect(alLlegar).toHaveBeenLastCalledWith(nuevo);
    await expect(getFeaturedBeaches()).resolves.toEqual(nuevo);
  });

  it('no deja que una petición en vuelo deshaga el mensaje del service worker', async () => {
    render(<Sonda alLlegar={jest.fn()} />);
    // The window the worker's stored copy travels through: the request was
    // resolved with the OLD body and lands after the message.
    emitir(ranking(4000, 'nubes'));
    const resolverFetch = fetchControlado();

    const enVuelo = getFeaturedBeaches({ force: true });
    const nuevo = ranking(4002, 'cielo claro');
    emitir(nuevo);
    await resolverFetch(ranking(4001, 'nubes'));

    await expect(enVuelo).resolves.toEqual(nuevo);
    await expect(getFeaturedBeaches()).resolves.toEqual(nuevo);
  });

  it('con el mismo ranking, gana el que juzgó las banderas más tarde', async () => {
    render(<Sonda alLlegar={jest.fn()} />);

    // The same assembled ranking, served twice. The later reading is the one
    // that already saw the flag expire: letting the earlier one win would put
    // a lifeguard flag back on a beach whose reading had run out.
    const tarde = ranking(6000, 'sin bandera', 6_500_000);
    emitir(tarde);
    emitir(ranking(6000, 'bandera verde', 6_000_000));

    await expect(getFeaturedBeaches()).resolves.toEqual(tarde);
  });

  it('ignora otros endpoints y cuerpos que no son un ranking', () => {
    const alLlegar = jest.fn();
    render(<Sonda alLlegar={alLlegar} />);

    emitir(ranking(5000, 'sol'), 'https://api.example/api/cantabria/beaches/3907590/details');
    emitir({ timestamp: 5000 });

    expect(alLlegar).not.toHaveBeenCalled();
  });
});
