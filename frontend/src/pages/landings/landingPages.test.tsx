import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import MunicipalityPage from './MunicipalityPage';
import MunicipalitiesIndex from './MunicipalitiesIndex';
import BeachLanding from './BeachLanding';
import BeachList from '../BeachList';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { beachesResponse } from '../../test/fixtures/beaches';
import { featuredResponse } from '../../test/fixtures/featured';
import { FEATURED_PATH, BEACHES_PATH } from '../../test/apiRoutes';

beforeEach(() => {
  installFetchMock([
    route(FEATURED_PATH, { json: featuredResponse }),
    route(BEACHES_PATH, { json: beachesResponse }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

describe('MunicipalityPage', () => {
  it('lists only the municipality beaches, with its own title', async () => {
    renderWithProviders(<MunicipalityPage />, {
      route: '/municipios/santander',
      path: '/municipios/:municipio',
    });

    expect(await screen.findByText('El Sardinero')).toBeInTheDocument();
    expect(screen.getByText('La Maruca')).toBeInTheDocument();
    expect(screen.queryByText('La Concha')).not.toBeInTheDocument();
    // Headline format, requested explicitly: "Playas del Municipio de X".
    expect(
      screen.getByRole('heading', { name: 'Playas del Municipio de Santander' })
    ).toBeInTheDocument();
    // The title lands with SeoHead's effect, a tick after the data render.
    await waitFor(() => expect(document.title).toContain('Santander'));
  });

  it('marks the Playas tab and offers a way back', async () => {
    renderWithProviders(<MunicipalityPage />, {
      route: '/municipios/santander',
      path: '/municipios/:municipio',
    });

    await screen.findByText('El Sardinero');
    expect(screen.getByRole('button', { name: 'Playas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('an unknown municipality explains and offers the list', async () => {
    renderWithProviders(<MunicipalityPage />, {
      route: '/municipios/no-existe',
      path: '/municipios/:municipio',
    });

    expect(
      await screen.findByText(/No conocemos ese municipio/)
    ).toBeInTheDocument();
  });
});

describe('MunicipalitiesIndex', () => {
  it('lists all municipalities with their beach count', async () => {
    renderWithProviders(<MunicipalitiesIndex />, { route: '/municipios' });

    expect(await screen.findByText('Suances')).toBeInTheDocument();
    // Santander has 2 beaches in the fixture; its row says so — and the row
    // is a REAL link with a copyable href.
    const santander = screen.getByText('Santander').closest('.ld-row');
    expect(santander).toHaveTextContent('2 playas');
    expect(santander?.tagName).toBe('A');
    expect(santander).toHaveAttribute('href', '/municipios/santander');
    // 5 unique municipalities in the fixture → 5 rows.
    expect(document.querySelectorAll('.ld-row')).toHaveLength(5);
    await waitFor(() => expect(document.title).toContain('Municipios'));
  });
});

describe('municipality access from the beach list', () => {
  it('the municipality name is a real link to its page', async () => {
    renderWithProviders(<BeachList />, { route: '/playas' });
    await screen.findByText('La Concha');

    // A real <a>: copyable, middle-clickable, honest role — and pointing
    // at the municipality, not the beach.
    const link = screen.getByRole('link', {
      name: 'Ver todas las playas de Suances',
    });
    expect(link).toHaveAttribute('href', '/municipios/suances');
  });
});

describe('LandingPlayas', () => {
  it('the webcams landing lists only beaches with an active webcam', async () => {
    renderWithProviders(<BeachLanding id="playas-con-webcam" />, {
      route: '/playas-con-webcam',
    });

    expect(await screen.findByText('La Concha')).toBeInTheDocument();
    // La Salvé's webcam is 'desactivada': not published.
    expect(screen.queryByText('La Salvé')).not.toBeInTheDocument();
    expect(document.title).toContain('webcam');
    // The intro carries the data-source honesty note.
    expect(screen.getByText(/la app no comprueba si emite/)).toBeInTheDocument();
    // And the conditions say how old the featured snapshot is.
    expect(await screen.findByText(/actualizado hace/)).toBeInTheDocument();
  });

  it('the lifeguard landing uses the catalog criterion', async () => {
    const { container } = renderWithProviders(
      <BeachLanding id="playas-con-socorrista" />,
      { route: '/playas-con-socorrista' }
    );

    await screen.findByText('La Concha');
    // Row TITLES only — "Laredo" is also a municipality label under La Salvé.
    const names = Array.from(container.querySelectorAll('.beach-card-name')).map(
      (el) => el.textContent
    );
    // Laredo (idCruzRoja 310) and La Concha (two posts) are in; La Arnía out.
    expect(names).toContain('Laredo');
    expect(names).toContain('La Concha');
    expect(names).not.toContain('La Arnía');
  });
});
