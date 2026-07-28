/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija `PlayasList` (ruta `/playas`): búsqueda normalizada, el combobox de
 * sugerencias con su navegación por teclado, los dos criterios de orden y los
 * badges de la tarjeta.
 *
 * Todos los tests comparten el mismo fixture a propósito: `services/api.ts`
 * cachea en variables de módulo durante 5 min, así que dentro de un mismo
 * fichero la segunda llamada ya no toca la red. Los estados de carga y error,
 * que necesitan la caché vacía, viven en `beachListPage.states.test.tsx`
 * (cada fichero de test estrena registro de módulos).
 */

import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

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

/** Nombres de las tarjetas, en el orden en que se pintan. */
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

    // La Maruca no está en el fixture de featured: ni emoji ni temperatura.
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

  it('sugiere a partir de 2 caracteres, en el orden original de la lista', async () => {
    await typeSearch('su');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.querySelector('.suggestion-name')?.textContent)).toEqual([
      'La Concha',
    ]);
  });

  it('corta en 5 sugerencias aunque haya más coincidencias', async () => {
    await typeSearch('la');
    // "la" casa con 6 playas (ver fixture), pero solo se listan 5.
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('ArrowDown recorre las sugerencias y vuelve al principio', async () => {
    const input = await typeSearch('la');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

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

  it('Enter selecciona la sugerencia activa y cierra la lista', async () => {
    const input = await typeSearch('la');

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
    // El cierre es diferido para que un click en una sugerencia llegue antes.
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('el click en una sugerencia la selecciona', async () => {
    const input = await typeSearch('su');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);

    expect(input).toHaveValue('La Concha');
  });
});

describe('PlayasList — badges de la tarjeta', () => {
  it('marca como vigilada si hay idCruzRoja o puestos de Cruz Roja', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (nombre: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === nombre) as HTMLElement;

    // Laredo trae idCruzRoja: 310; El Sardinero, 101.
    expect(byName('Laredo').querySelector('.badge-vigilada')).not.toBeNull();
    expect(byName('El Sardinero').querySelector('.badge-vigilada')).not.toBeNull();
    // La Concha tiene dos puestos: vigilada venga como venga el idCruzRoja.
    expect(byName('La Concha').querySelector('.badge-vigilada')).not.toBeNull();
    // La Arnía no tiene ni id ni puestos: es el caso negativo real.
    expect(byName('La Arnía').querySelector('.badge-vigilada')).toBeNull();
  });

  it('oculta el badge de webcam cuando está desactivada', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (nombre: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === nombre) as HTMLElement;

    expect(byName('La Concha').querySelector('.badge-webcam')).not.toBeNull();
    // La Salvé tiene webcam con estado 'desactivada'.
    expect(byName('La Salvé').querySelector('.badge-webcam')).toBeNull();
  });

  it('muestra como mucho 4 iconos de atributos', async () => {
    const { container } = await renderList();
    const laConcha = Array.from(container.querySelectorAll('.beach-card')).find(
      (c) => c.querySelector('.beach-card-name')?.textContent === 'La Concha',
    ) as HTMLElement;

    // La Concha tiene 6 atributos activos en el fixture.
    expect(laConcha.querySelectorAll('.beach-attr-mini')).toHaveLength(4);
  });
});

describe('PlayasList — orden por cercanía', () => {
  it('no ofrece el orden por cercanía sin ubicación', async () => {
    await renderList();
    expect(screen.queryByLabelText('Ordenar por cercanía')).not.toBeInTheDocument();
  });

  it('ordena por distancia y muestra los km cuando hay ubicación', async () => {
    setGeolocation([43.42, -3.43]); // junto a Laredo
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
