import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import MunicipioPage from './MunicipioPage';
import LandingPlayas from './LandingPlayas';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route } from '../../test/http/fakeFetch';
import { beachesResponse } from '../../test/fixtures/beaches';
import { featuredResponse } from '../../test/fixtures/featured';
import { RUTA_DESTACADAS, RUTA_PLAYAS } from '../../test/apiRoutes';

beforeEach(() => {
  installFetchMock([
    route(RUTA_DESTACADAS, { json: featuredResponse }),
    route(RUTA_PLAYAS, { json: beachesResponse }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

describe('MunicipioPage', () => {
  it('lista solo las playas del municipio, con título propio', async () => {
    renderWithProviders(<MunicipioPage />, {
      route: '/municipios/santander',
      path: '/municipios/:municipio',
    });

    expect(await screen.findByText('El Sardinero')).toBeInTheDocument();
    expect(screen.getByText('La Maruca')).toBeInTheDocument();
    expect(screen.queryByText('La Concha')).not.toBeInTheDocument();
    expect(screen.getByText('Playas de Santander')).toBeInTheDocument();
    // The title lands with SeoHead's effect, a tick after the data render.
    await waitFor(() => expect(document.title).toContain('Santander'));
  });

  it('un municipio desconocido explica y ofrece el listado', async () => {
    renderWithProviders(<MunicipioPage />, {
      route: '/municipios/no-existe',
      path: '/municipios/:municipio',
    });

    expect(
      await screen.findByText(/No conocemos ese municipio/)
    ).toBeInTheDocument();
  });
});

describe('LandingPlayas', () => {
  it('la landing de webcams lista solo playas con webcam activa', async () => {
    renderWithProviders(<LandingPlayas id="playas-con-webcam" />, {
      route: '/playas-con-webcam',
    });

    expect(await screen.findByText('La Concha')).toBeInTheDocument();
    // La Salvé's webcam is 'desactivada': not published.
    expect(screen.queryByText('La Salvé')).not.toBeInTheDocument();
    expect(document.title).toContain('webcam');
    // The intro carries the data-source honesty note.
    expect(screen.getByText(/la app no comprueba si emite/)).toBeInTheDocument();
  });

  it('la landing de socorrismo usa el criterio del catálogo', async () => {
    const { container } = renderWithProviders(
      <LandingPlayas id="playas-con-socorrista" />,
      { route: '/playas-con-socorrista' }
    );

    await screen.findByText('La Concha');
    // Row TITLES only — "Laredo" is also a municipality label under La Salvé.
    const nombres = Array.from(container.querySelectorAll('.ld-fila-titulo')).map(
      (el) => el.textContent
    );
    // Laredo (idCruzRoja 310) and La Concha (two posts) are in; La Arnía out.
    expect(nombres).toContain('Laredo');
    expect(nombres).toContain('La Concha');
    expect(nombres).not.toContain('La Arnía');
  });
});
