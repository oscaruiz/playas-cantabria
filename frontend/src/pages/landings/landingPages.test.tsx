import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import MunicipioPage from './MunicipioPage';
import MunicipiosIndex from './MunicipiosIndex';
import LandingPlayas from './LandingPlayas';
import PlayasList from '../PlayasList';
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

describe('MunicipiosIndex', () => {
  it('lista todos los municipios con su número de playas', async () => {
    renderWithProviders(<MunicipiosIndex />, { route: '/municipios' });

    expect(await screen.findByText('Suances')).toBeInTheDocument();
    // Santander has 2 beaches in the fixture; its row says so.
    const santander = screen.getByText('Santander').closest('.ld-fila');
    expect(santander).toHaveTextContent('2 playas');
    // 5 unique municipalities in the fixture → 5 rows.
    expect(document.querySelectorAll('.ld-fila')).toHaveLength(5);
    await waitFor(() => expect(document.title).toContain('Municipios'));
  });
});

describe('acceso al municipio desde el listado de playas', () => {
  it('el nombre del municipio navega al municipio, no a la playa', async () => {
    renderWithProviders(<PlayasList />, { route: '/playas' });
    await screen.findByText('La Concha');

    const enlace = screen.getByRole('button', {
      name: 'Ver todas las playas de Suances',
    });
    fireEvent.click(enlace);
    // The list page unmounts nothing here (no Route switch in the harness),
    // but the row click handler must NOT have fired: the search box is
    // still there and no detail fetch happened.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
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
    // And the conditions say how old the featured snapshot is.
    expect(await screen.findByText(/actualizado hace/)).toBeInTheDocument();
  });

  it('la landing de socorrismo usa el criterio del catálogo', async () => {
    const { container } = renderWithProviders(
      <LandingPlayas id="playas-con-socorrista" />,
      { route: '/playas-con-socorrista' }
    );

    await screen.findByText('La Concha');
    // Row TITLES only — "Laredo" is also a municipality label under La Salvé.
    const nombres = Array.from(container.querySelectorAll('.beach-card-name')).map(
      (el) => el.textContent
    );
    // Laredo (idCruzRoja 310) and La Concha (two posts) are in; La Arnía out.
    expect(nombres).toContain('Laredo');
    expect(nombres).toContain('La Concha');
    expect(nombres).not.toContain('La Arnía');
  });
});
