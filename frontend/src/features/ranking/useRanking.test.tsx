/**
 * The module every screen that paints a sky reads.
 *
 * What is asked of it here is what the five pages used to wire by hand: the
 * first answer, the one the service worker delivers late, whether what is
 * painted is a copy from an earlier visit, and asking again when it is.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useRanking } from './useRanking';
import { API_UPDATED_MESSAGE } from '../../../../../../Dev/playas-cantabria/frontend/src/hooks/useServiceWorkerRefresh';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { FEATURED_PATH as FEATURED } from '../../test/apiRoutes';
import type { FeaturedBeachesResponse } from '../../services/api';

const URL_FEATURED = 'https://api.example/api/cantabria/beaches/featured';

/** jsdom does not ship `navigator.serviceWorker`: an EventTarget is enough. */
const channel = new EventTarget();

beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', { value: channel, configurable: true });
});

/**
 * The module cache lives in `services/api` and does NOT reset between tests —
 * the same way it does not reset between two pages of the app, which is the
 * whole point. Each case therefore moves the clock forward past its 60 s and
 * picks instants of its own.
 */
let now = Date.now();

beforeEach(() => {
  now += 2 * 60 * 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => restoreFetch());

function ranking(ageMinutes: number, sky: string): FeaturedBeachesResponse {
  return {
    timestamp: Date.now() - ageMinutes * 60 * 1000,
    playas: [],
    revisar: [],
    resumenTodas: [{ codigo: '1', descripcionClima: sky }],
  } as unknown as FeaturedBeachesResponse;
}

function deliverFromSW(data: unknown, url = URL_FEATURED) {
  act(() => {
    const event = new Event('message') as Event & { data?: unknown };
    event.data = { type: API_UPDATED_MESSAGE, url, datos: data };
    channel.dispatchEvent(event);
  });
}

const Probe: React.FC = () => {
  const { ranking: inForce, fromPreviousVisit, loading, error } = useRanking();
  if (loading) return <p>cargando</p>;
  return (
    <div>
      <p>{inForce?.resumenTodas[0]?.descripcionClima ?? 'sin ranking'}</p>
      {fromPreviousVisit && <p>de visita anterior</p>}
      {error && <p>falló</p>}
    </div>
  );
};

describe('useRanking', () => {
  it('pinta la primera respuesta y no avisa de nada si es de ahora', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'cielo claro') })]);

    render(<Probe />);

    expect(await screen.findByText('cielo claro')).toBeInTheDocument();
    expect(screen.queryByText('de visita anterior')).not.toBeInTheDocument();
  });

  it('dice que lo pintado es de una visita anterior cuando es viejo', async () => {
    // Un solo reintento sale solo; devuelve lo mismo, así que el aviso se queda.
    installFetchMock([route(FEATURED, { json: ranking(90, 'cielo de anoche') })]);

    render(<Probe />);

    expect(await screen.findByText('de visita anterior')).toBeInTheDocument();
  });

  it('vuelve a pedir por su cuenta, y el aviso se retira al llegar lo nuevo', async () => {
    let calls = 0;
    installFetchMock([
      route(FEATURED, () => ({
        json: calls++ === 0 ? ranking(90, 'cielo de anoche') : ranking(0, 'cielo claro'),
      })),
    ]);

    render(<Probe />);

    expect(await screen.findByText('cielo claro')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('de visita anterior')).not.toBeInTheDocument(),
    );
    expect(calls).toBe(2);
  });

  it('vuelve a pedir a los diez minutos sin avisar de nada', async () => {
    // Los dos umbrales son preguntas distintas: a los diez minutos el backend ya
    // tiene algo más nuevo que dar —su TTL fresco son cinco—, pero sigue siendo
    // SU respuesta, así que no hay nada que decirle al usuario. Juntarlos otra
    // vez significa o encender el aviso en un día normal, o dejar de refrescar
    // una pantalla abierta y quieta durante una hora.
    let calls = 0;
    installFetchMock([
      route(FEATURED, () => ({
        json: calls++ === 0 ? ranking(20, 'cielo de hace un rato') : ranking(0, 'cielo recién hecho'),
      })),
    ]);

    render(<Probe />);

    // Cielos con nombre propio: el ranking en vigor no se reinicia entre casos,
    // así que reutilizar el de otro test haría pasar este sin pedir nada.
    expect(await screen.findByText('cielo recién hecho')).toBeInTheDocument();
    expect(calls).toBe(2);
    expect(screen.queryByText('de visita anterior')).not.toBeInTheDocument();
  });

  it('pinta el ranking que el service worker entrega tarde', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'nubes') })]);

    render(<Probe />);
    await screen.findByText('nubes');

    deliverFromSW(ranking(0, 'cielo claro'));

    expect(await screen.findByText('cielo claro')).toBeInTheDocument();
  });

  it('ignora otros endpoints y cuerpos que no son un ranking', async () => {
    installFetchMock([route(FEATURED, { json: ranking(0, 'nubes') })]);

    render(<Probe />);
    await screen.findByText('nubes');

    deliverFromSW(ranking(0, 'cielo claro'), 'https://api.example/api/cantabria/beaches');
    deliverFromSW({ timestamp: Date.now() });

    expect(screen.getByText('nubes')).toBeInTheDocument();
  });

  it('avisa del fallo sin borrar el cielo que ya estaba en vigor', async () => {
    // El ranking en vigor sobrevive a una petición fallida a propósito: es
    // exactamente lo que hace útil la app en la playa con mala cobertura.
    installFetchMock([route(FEATURED, { status: 503 })]);

    render(<Probe />);

    expect(await screen.findByText('falló')).toBeInTheDocument();
    expect(screen.queryByText('sin ranking')).not.toBeInTheDocument();
  });
});
