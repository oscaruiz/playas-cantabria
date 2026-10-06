/**
 * Favorites wired into the real pages: the star on the list rows, the
 * favorites-only filter with its empty state, and the star in the detail
 * header. Fixtures and routes are the same the characterization suite uses.
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import BeachList from '../../pages/BeachList';
import BeachDetailPage from '../../pages/BeachDetailPage';
import HomePage from '../../pages/HomePage';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { beachesResponse } from '../../test/fixtures/beaches';
import { featuredResponse } from '../../test/fixtures/featured';
import { buildOpenWeatherDetail } from '../../test/fixtures/beachDetail';
import { localNoon } from '../../test/time';
import {
  FEATURED_PATH,
  BEACHES_PATH,
  DETAIL_PATH,
} from '../../test/apiRoutes';
import { reloadFavorites } from './application/useFavorites';

beforeEach(() => {
  localStorage.clear();
  reloadFavorites();
  installFetchMock([
    route(FEATURED_PATH, { json: featuredResponse }),
    route(BEACHES_PATH, { json: beachesResponse }),
    route(DETAIL_PATH, { json: buildOpenWeatherDetail(localNoon('2026-07-27')) }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

async function renderList() {
  const view = renderWithProviders(<BeachList />, { route: '/playas' });
  await screen.findByText('La Concha');
  return view;
}

function cardNamesOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.beach-card-name')).map(
    (el) => el.textContent ?? ''
  );
}

describe('favorites in the list', () => {
  it('each row has its star, and starring does not open the detail', async () => {
    await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar La Arnía en favoritas' }));

    // Still on the list: saving must not navigate to the beach.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quitar La Arnía de favoritas' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('the filter leaves only favorites, with a counter, and composes with the search', async () => {
    const { container } = await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar La Arnía en favoritas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar solo favoritas' }));

    expect(cardNamesOf(container)).toEqual(['La Arnía']);
    expect(screen.getByText(/1 playa/)).toBeInTheDocument();

    // Search composes on top of the favorites filter.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'concha' } });
    expect(container.querySelectorAll('.beach-card')).toHaveLength(0);

    // And switching the filter off restores the full list.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar solo favoritas' }));
    expect(cardNamesOf(container)).toHaveLength(7);
  });

  it('with no favorites, the filter shows an empty state that explains how to save', async () => {
    await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar solo favoritas' }));

    expect(screen.getByText(/Aún no tienes playas favoritas/)).toBeInTheDocument();
  });
});

describe('favorites on the home page', () => {
  function saveFavorite(code: string) {
    localStorage.setItem(
      'playas:favoritas',
      JSON.stringify({ version: 1, beachCodes: [code] })
    );
    reloadFavorites();
  }

  it('the "Tus playas favoritas" section comes first, with the saved beach', async () => {
    saveFavorite('3908503'); // La Concha
    const { container } = renderWithProviders(<HomePage />, { route: '/' });

    const section = await screen.findByText('Tus playas favoritas');
    expect(section).toBeInTheDocument();
    // First section of the body: favorites go at the very top.
    const first = container.querySelector('.hp-body section');
    expect(first).toHaveClass('hp-section--favorites');
    expect(first).toHaveTextContent('La Concha');
    // With the ranking loaded, the row carries current conditions.
    await waitFor(() => expect(first).toHaveTextContent('22°'));
  });

  it('with no favorites there is no section', async () => {
    renderWithProviders(<HomePage />, { route: '/' });
    await screen.findByText('La mejor playa para hoy');
    expect(screen.queryByText('Tus playas favoritas')).not.toBeInTheDocument();
  });
});

describe('favorite from the detail', () => {
  it('the header star marks the beach and persists', async () => {
    renderWithProviders(<BeachDetailPage />, {
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
