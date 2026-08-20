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
  it('compone la frase, la franja y el cambio del ejemplo aprobado', async () => {
    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText('La Concha');

    // Frase por bandas: 93 ≥ 75. El nombre va interpolado, nunca a fuego.
    expect(screen.getByText('La Concha está muy bien hoy')).toBeInTheDocument();
    // 09:00–12:00 UTC pintadas en hora de Madrid.
    expect(screen.getByText('Mejor momento: 11:00–14:00')).toBeInTheDocument();
    expect(screen.getByText('A partir de las 17:00 aumenta el viento')).toBeInTheDocument();
  });
});

describe('MejorMomento — sin datos no se inventa nada', () => {
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
