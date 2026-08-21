/**
 * "Mejor hora para ir": la portada no solo dice si la mejor playa está bien,
 * dice CUÁNDO ir — la frase por bandas, la mejor franja del día y el primer
 * cambio a peor. Las horas llegan del API como instantes UTC y aquí se
 * comprueban ya compuestas en hora de Madrid (verano, UTC+2).
 */

import React from 'react';
import { screen } from '@testing-library/react';
import HomePage from '../../pages/HomePage';
import MejorMomento from '../../components/MejorMomento';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';

const NOW = featuredResponse.timestamp + 30 * 60 * 1000;

beforeEach(() => {
  localStorage.removeItem('user_location');
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => {
  restoreFetch();
  jest.restoreAllMocks();
});

describe('HomePage — mejor momento del día en el hero', () => {
  it('compone la frase, la franja empezada y el cambio del ejemplo aprobado', async () => {
    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText('La Concha');

    // Frase por bandas: 93 ≥ 75. El nombre va interpolado, nunca a fuego.
    expect(screen.getByText('La Concha está muy bien hoy')).toBeInTheDocument();
    // Son las 12:30 Madrid y la ventana es 11:00–14:00: ya está empezada, y
    // anunciar un inicio en el pasado leería como dato caducado. Se dice lo
    // que queda de ella.
    expect(screen.getByText('Buen momento hasta las 14:00')).toBeInTheDocument();
    expect(screen.getByText('A partir de las 17:00 aumenta el viento')).toBeInTheDocument();
  });
});

describe('MejorMomento — sin datos no se inventa nada', () => {
  // Las ventanas de estos casos viven el 27-jul: el reloj se ancla antes de
  // su inicio para que el guard de caducidad no las vea pasadas.
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T08:00:00.000Z'));
  });

  it('sin ventana no pinta nada', () => {
    const { container } = renderWithProviders(<MejorMomento ventana={null} />, { route: '/' });
    expect(container.querySelector('.mejor-momento')).toBeNull();
  });

  it('una ventana que llega al final de la franja no avisa de ningún cambio', () => {
    renderWithProviders(
      <MejorMomento
        ventana={{
          inicio: '2026-07-27T09:00:00.000Z',
          fin: '2026-07-27T19:00:00.000Z',
          cambio: null,
        }}
      />,
      { route: '/' },
    );

    expect(screen.getByText('Mejor momento: 11:00–21:00')).toBeInTheDocument();
    expect(screen.queryByText(/A partir de las/)).toBeNull();
  });
});

describe('MejorMomento — el reloj manda sobre la caché', () => {
  it('una ventana ya terminada no se pinta: venía de una respuesta cacheada', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T20:00:00.000Z'));
    const { container } = renderWithProviders(
      <MejorMomento
        ventana={{ inicio: '2026-07-27T09:00:00.000Z', fin: '2026-07-27T12:00:00.000Z', cambio: null }}
      />,
      { route: '/' },
    );

    expect(container.querySelector('.mejor-momento')).toBeNull();
  });

  it('una ventana empezada dice lo que queda, no un inicio en el pasado', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T10:30:00.000Z'));
    renderWithProviders(
      <MejorMomento
        ventana={{ inicio: '2026-07-27T09:00:00.000Z', fin: '2026-07-27T12:00:00.000Z', cambio: null }}
      />,
      { route: '/' },
    );

    expect(screen.getByText('Buen momento hasta las 14:00')).toBeInTheDocument();
    expect(screen.queryByText(/Mejor momento/)).toBeNull();
  });
});

describe('MejorMomento — el porqué, solo en la vista detallada', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-27T08:00:00.000Z'));
  });

  const ventanaConMotivo = {
    inicio: '2026-07-27T09:00:00.000Z',
    fin: '2026-07-27T13:00:00.000Z',
    cambio: { desde: '2026-07-27T13:00:00.000Z', causa: 'lluvia_prevista' as const },
    motivo: 'sin_lluvia' as const,
    horasConsideradas: 10,
  };

  it('con `detallada` nombra el motivo del tramo junto al cambio', () => {
    renderWithProviders(<MejorMomento ventana={ventanaConMotivo} detallada />, { route: '/' });

    expect(screen.getByText('Elegido por ser el tramo sin lluvia previsto')).toBeInTheDocument();
    expect(screen.getByText('A partir de las 15:00 se espera lluvia')).toBeInTheDocument();
  });

  it('sin `detallada` (la portada) el motivo no sale: la tarjeta se queda compacta', () => {
    renderWithProviders(<MejorMomento ventana={ventanaConMotivo} />, { route: '/' });

    expect(screen.queryByText(/Elegido por/)).toBeNull();
  });

  it('sin motivo ni cambio, la calma también se dice', () => {
    renderWithProviders(
      <MejorMomento
        ventana={{ inicio: '2026-07-27T09:00:00.000Z', fin: '2026-07-27T19:00:00.000Z', cambio: null, motivo: null }}
        detallada
      />,
      { route: '/' },
    );

    expect(screen.getByText('Sin empeoramientos a la vista hasta el cierre del día')).toBeInTheDocument();
  });
});
