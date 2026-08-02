/**
 * Favorites wired into the real pages: the star on the list rows, the
 * favorites-only filter with its empty state, and the star in the detail
 * header. Fixtures and routes are the same the characterization suite uses.
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import PlayaDetallePage from '../../pages/PlayaDetalle';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { beachesResponse } from '../../test/fixtures/beaches';
import { featuredResponse } from '../../test/fixtures/featured';
import { buildOpenWeatherDetail } from '../../test/fixtures/beachDetail';
import { localNoon } from '../../test/time';
import {
  RUTA_DESTACADAS,
  RUTA_PLAYAS,
  RUTA_DETALLE,
} from '../../test/apiRoutes';
import { recargarFavoritas } from './useFavorites';

beforeEach(() => {
  localStorage.clear();
  recargarFavoritas();
  installFetchMock([
    route(RUTA_DESTACADAS, { json: featuredResponse }),
    route(RUTA_PLAYAS, { json: beachesResponse }),
    route(RUTA_DETALLE, { json: buildOpenWeatherDetail(localNoon('2026-07-27')) }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

async function renderList() {
  const view = renderWithProviders(<PlayasList />, { route: '/playas' });
  await screen.findByText('La Concha');
  return view;
}

function nombresDeTarjetas(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.beach-card-name')).map(
    (el) => el.textContent ?? ''
  );
}

describe('favoritas en el listado', () => {
  it('cada fila tiene su estrella, y marcar no abre el detalle', async () => {
    await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar La Arnía en favoritas' }));

    // Still on the list: saving must not navigate to the beach.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quitar La Arnía de favoritas' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('el filtro deja solo las favoritas, con contador, y compone con la búsqueda', async () => {
    const { container } = await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar La Arnía en favoritas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar solo favoritas' }));

    expect(nombresDeTarjetas(container)).toEqual(['La Arnía']);
    expect(screen.getByText(/1 playa/)).toBeInTheDocument();

    // Search composes on top of the favorites filter.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'concha' } });
    expect(container.querySelectorAll('.beach-card')).toHaveLength(0);

    // And switching the filter off restores the full list.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar solo favoritas' }));
    expect(nombresDeTarjetas(container)).toHaveLength(7);
  });

  it('sin favoritas, el filtro muestra un estado vacío que explica cómo guardar', async () => {
    await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar solo favoritas' }));

    expect(screen.getByText(/Aún no tienes playas favoritas/)).toBeInTheDocument();
  });
});

describe('favoritas en la página de inicio', () => {
  function guardarFavorita(codigo: string) {
    localStorage.setItem(
      'playas:favoritas',
      JSON.stringify({ version: 1, beachCodes: [codigo] })
    );
    recargarFavoritas();
  }

  it('la sección "Tus playas favoritas" sale la primera, con la playa guardada', async () => {
    guardarFavorita('3908503'); // La Concha
    const { container } = renderWithProviders(<HomePage />, { route: '/' });

    const seccion = await screen.findByText('Tus playas favoritas');
    expect(seccion).toBeInTheDocument();
    // First section of the body: favorites go at the very top.
    const primera = container.querySelector('.hp-body section');
    expect(primera).toHaveClass('hp-section--favoritas');
    expect(primera).toHaveTextContent('La Concha');
    // With the ranking loaded, the row carries current conditions.
    await waitFor(() => expect(primera).toHaveTextContent('22°'));
  });

  it('sin favoritas no hay sección', async () => {
    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText('La mejor playa para hoy');
    expect(screen.queryByText('Tus playas favoritas')).not.toBeInTheDocument();
  });
});

describe('favorita desde el detalle', () => {
  it('la estrella de la cabecera marca la playa y persiste', async () => {
    renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/3908503',
      path: '/playas/:codigo',
    });

    const btn = await screen.findByRole('button', { name: /en favoritas$/ });
    fireEvent.click(btn);

    // The re-render is not synchronous here: the page has other updates in
    // flight (featured score), so the store notification lands a tick later.
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
    expect(
      JSON.parse(localStorage.getItem('playas:favoritas') as string).beachCodes
    ).toHaveLength(1);
  });
});
