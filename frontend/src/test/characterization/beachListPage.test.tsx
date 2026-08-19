/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `PlayasList` (route `/playas`): normalized search, the suggestions
 * combobox with its keyboard navigation, the two sort criteria and the card
 * badges.
 *
 * All the tests share the same fixture on purpose: `services/api.ts` caches in
 * module variables for 5 min, so within one and the same file the second call
 * no longer touches the network. The loading and error states, which need the
 * cache empty, live in `beachListPage.states.test.tsx`
 * (each test file gets a brand-new module registry).
 */

import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route } from 'react-router-dom';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';


function setGeolocation(coords: [number, number] | null) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: coords
      ? {
          getCurrentPosition: (success: (p: unknown) => void) =>
            success({ coords: { latitude: coords[0], longitude: coords[1] } }),
        }
      : undefined,
  });
}

/** Card names, in the order in which they are painted. */
function cardNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.beach-card-name')).map(
    (el) => el.textContent ?? '',
  );
}

async function renderList() {
  const view = renderWithProviders(<PlayasList />, { route: '/playas' });
  await screen.findByText('La Concha');
  return view;
}

beforeEach(() => {
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(BEACHES, { json: beachesResponse }),
  ]);
  setGeolocation(null);
});

afterEach(() => {
  restoreFetch();
});

describe('PlayasList — listado', () => {
  it('ordena alfabéticamente por defecto', async () => {
    const { container } = await renderList();

    expect(cardNames(container)).toEqual([
      'El Sardinero',
      'La Arnía',
      'La Concha',
      'La Maruca',
      'La Salvé',
      'Langre',
      'Laredo',
    ]);
  });

  it('muestra el contador en plural', async () => {
    await renderList();
    expect(screen.getByText('7 playas')).toBeInTheDocument();
  });

  it('enriquece con clima solo las playas presentes en resumenTodas', async () => {
    const { container } = await renderList();

    const laConcha = container.querySelectorAll('.beach-card')[2];
    expect(within(laConcha as HTMLElement).getByText('22°')).toBeInTheDocument();
    expect(laConcha.querySelector('.beach-card-sky')).toHaveTextContent('☀️');

    // La Maruca is not in the featured fixture: neither emoji nor temperature.
    const laMaruca = container.querySelectorAll('.beach-card')[3];
    expect(laMaruca.querySelector('.beach-card-sky')).toBeNull();
    expect(laMaruca.querySelector('.beach-card-temp')).toBeNull();
  });
});

describe('PlayasList — búsqueda', () => {
  async function search(term: string) {
    const { container } = await renderList();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: term } });
    return container;
  }

  it('encuentra ignorando las tildes', async () => {
    const container = await search('arnia');
    expect(cardNames(container)).toEqual(['La Arnía']);
  });

  it('encuentra por alias', async () => {
    const container = await search('covachos');
    expect(cardNames(container)).toEqual(['La Arnía']);
  });

  it('encuentra por municipio', async () => {
    const container = await search('suances');
    expect(cardNames(container)).toEqual(['La Concha']);
  });

  it('muestra el contador filtrado con el término', async () => {
    await search('arnia');
    expect(screen.getByText(/1 playa/)).toBeInTheDocument();
    expect(screen.getByText(/para "arnia"/)).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay coincidencias', async () => {
    await search('zzzz');
    expect(
      screen.getByText('No se encontraron playas para "zzzz"'),
    ).toBeInTheDocument();
  });

  it('el botón de borrar limpia el filtro', async () => {
    const container = await search('arnia');
    fireEvent.click(screen.getByLabelText('Borrar búsqueda'));
    expect(cardNames(container)).toHaveLength(7);
  });
});

describe('PlayasList — sugerencias', () => {
  async function typeSearch(term: string) {
    await renderList();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: term } });
    return input;
  }

  it('no sugiere con menos de 2 caracteres', async () => {
    await typeSearch('l');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('sugiere municipios primero y luego playas', async () => {
    // "su" matches the municipality Suances AND its beach La Concha: the
    // municipality (the broader answer) leads.
    await typeSearch('su');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.querySelector('.suggestion-name')?.textContent)).toEqual([
      'Suances',
      'La Concha',
    ]);
    // The municipality row says what it is and how many beaches it has.
    expect(options[0].querySelector('.suggestion-municipio')?.textContent).toContain(
      'Municipio',
    );
  });

  it('corta en 5 sugerencias aunque haya más coincidencias', async () => {
    await typeSearch('la');
    // "la" matches 6 beaches (see fixture), but only 5 are listed.
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('ArrowDown recorre las sugerencias y vuelve al principio', async () => {
    const input = await typeSearch('la');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    // The combobox tells assistive tech WHICH option is active.
    expect(input).toHaveAttribute('aria-activedescendant', 'sugerencia-0');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('id', 'sugerencia-0');

    for (let i = 0; i < 4; i += 1) fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[4]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp desde el principio salta a la última', async () => {
    const input = await typeSearch('la');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[4]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter sobre una playa activa la selecciona y cierra la lista', async () => {
    const input = await typeSearch('la');

    // "la" puts two municipalities first (Laredo, Piélagos); the third
    // option is the first beach, La Concha.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('La Concha');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Enter sin sugerencia activa no selecciona nada', async () => {
    const input = await typeSearch('la');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('la');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('Escape cierra la lista sin cambiar el filtro', async () => {
    const input = await typeSearch('la');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('la');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('el blur cierra la lista tras 150 ms', async () => {
    const input = await typeSearch('la');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.blur(input);
    // The close is deferred so that a click on a suggestion arrives first.
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('el click en una sugerencia de playa la selecciona', async () => {
    const input = await typeSearch('su');
    // Option 0 is the municipality Suances; option 1 is the beach.
    fireEvent.mouseDown(screen.getAllByRole('option')[1]);

    expect(input).toHaveValue('La Concha');
  });

  it('elegir un municipio navega a su página', async () => {
    renderWithProviders(
      <>
        <PlayasList />
        <Route
          path="/municipios/:municipio"
          render={({ match }) => <div>EN-MUNICIPIO:{match.params.municipio}</div>}
        />
      </>,
      { route: '/playas' },
    );
    await screen.findByText('La Concha');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'suan' } });

    fireEvent.mouseDown(screen.getAllByRole('option')[0]);

    expect(await screen.findByText('EN-MUNICIPIO:suances')).toBeInTheDocument();
  });
});

describe('PlayasList — filtro de webcam', () => {
  it('deja solo las playas con webcam activa y se puede quitar', async () => {
    const { container } = await renderList();
    const boton = screen.getByRole('button', { name: 'Mostrar solo playas con webcam' });

    fireEvent.click(boton);
    // La Salvé also has a webcam, but 'desactivada': it must stay out.
    expect(cardNames(container)).toEqual(['La Concha']);
    expect(boton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(boton);
    expect(cardNames(container)).toHaveLength(7);
  });
});

describe('PlayasList — badges de la tarjeta', () => {
  it('marca como vigilada si hay idCruzRoja o puestos de Cruz Roja', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (nombre: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === nombre) as HTMLElement;

    // Laredo carries idCruzRoja: 310; El Sardinero, 101.
    expect(byName('Laredo').querySelector('.badge-vigilada')).not.toBeNull();
    expect(byName('El Sardinero').querySelector('.badge-vigilada')).not.toBeNull();
    // La Concha has two posts: watched no matter how the idCruzRoja comes in.
    expect(byName('La Concha').querySelector('.badge-vigilada')).not.toBeNull();
    // La Arnía has neither id nor posts: it is the real negative case.
    expect(byName('La Arnía').querySelector('.badge-vigilada')).toBeNull();
  });

  it('oculta el badge de webcam cuando está desactivada', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (nombre: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === nombre) as HTMLElement;

    expect(byName('La Concha').querySelector('.badge-webcam')).not.toBeNull();
    // La Salvé has a webcam with status 'desactivada'.
    expect(byName('La Salvé').querySelector('.badge-webcam')).toBeNull();
  });

  it('muestra el badge de Bandera Azul solo en playas premiadas', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (nombre: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === nombre) as HTMLElement;

    // La Concha carries banderaAzul: 2026 in the fixture; La Salvé does not.
    expect(byName('La Concha').querySelector('.badge-bandera-azul')).not.toBeNull();
    expect(byName('La Salvé').querySelector('.badge-bandera-azul')).toBeNull();
  });

  it('cada tarjeta dice si la playa va a mejor y por qué', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (nombre: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === nombre) as HTMLElement;

    const chip = byName('La Concha').querySelector('.trend-badge');
    expect(chip).toHaveTextContent('Está mejorando');
    expect(chip).toHaveTextContent('se despeja');
    // El backend ya lo dice en razonRanking; con el chip se diría dos veces.
    expect(byName('La Concha').querySelector('.beach-card-reason')).not.toHaveTextContent(
      'próximas horas',
    );

    // La Arnía viene "estable": en una lista eso es una línea de ruido por
    // tarjeta, así que no se pinta.
    expect(byName('La Arnía').querySelector('.trend-badge')).toBeNull();
  });

  it('muestra como mucho 4 iconos de atributos', async () => {
    const { container } = await renderList();
    const laConcha = Array.from(container.querySelectorAll('.beach-card')).find(
      (c) => c.querySelector('.beach-card-name')?.textContent === 'La Concha',
    ) as HTMLElement;

    // La Concha has 6 active attributes in the fixture.
    expect(laConcha.querySelectorAll('.beach-attr-mini')).toHaveLength(4);
  });
});

describe('PlayasList — orden por cercanía', () => {
  it('no ofrece el orden por cercanía sin ubicación', async () => {
    await renderList();
    expect(screen.queryByLabelText('Ordenar por cercanía')).not.toBeInTheDocument();
  });

  it('ordena por distancia y muestra los km cuando hay ubicación', async () => {
    setGeolocation([43.42, -3.43]); // next to Laredo
    const { container } = await renderList();

    fireEvent.click(screen.getByLabelText('Ordenar por cercanía'));

    expect(cardNames(container).slice(0, 2)).toEqual(['Laredo', 'La Salvé']);
    expect(container.querySelector('.beach-card-dist')).toHaveTextContent('· a 0 km');
  });

  it('el botón AZ devuelve al orden alfabético', async () => {
    setGeolocation([43.42, -3.43]);
    const { container } = await renderList();

    fireEvent.click(screen.getByLabelText('Ordenar por cercanía'));
    fireEvent.click(screen.getByLabelText('Ordenar A-Z'));

    expect(cardNames(container)[0]).toBe('El Sardinero');
  });
});
