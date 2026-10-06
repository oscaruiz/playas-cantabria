/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `BeachList` (route `/playas`): normalized search, the suggestions
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
import BeachList from '../../pages/BeachList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import { FEATURED_PATH as FEATURED, BEACHES_PATH as BEACHES } from '../apiRoutes';


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
  const view = renderWithProviders(<BeachList />, { route: '/playas' });
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

describe('BeachList — listing', () => {
  it('sorts alphabetically by default', async () => {
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

  it('shows the counter in plural', async () => {
    await renderList();
    expect(screen.getByText('7 playas')).toBeInTheDocument();
  });

  it('enriches with weather only the beaches present in resumenTodas', async () => {
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

describe('BeachList — search', () => {
  async function search(term: string) {
    const { container } = await renderList();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: term } });
    return container;
  }

  it('finds ignoring accents', async () => {
    const container = await search('arnia');
    expect(cardNames(container)).toEqual(['La Arnía']);
  });

  it('finds by alias', async () => {
    const container = await search('covachos');
    expect(cardNames(container)).toEqual(['La Arnía']);
  });

  it('finds by municipality', async () => {
    const container = await search('suances');
    expect(cardNames(container)).toEqual(['La Concha']);
  });

  it('shows the filtered counter with the term', async () => {
    await search('arnia');
    expect(screen.getByText(/1 playa/)).toBeInTheDocument();
    expect(screen.getByText(/para "arnia"/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no matches', async () => {
    await search('zzzz');
    expect(
      screen.getByText('No se encontraron playas para "zzzz"'),
    ).toBeInTheDocument();
  });

  it('the clear button clears the filter', async () => {
    const container = await search('arnia');
    fireEvent.click(screen.getByLabelText('Borrar búsqueda'));
    expect(cardNames(container)).toHaveLength(7);
  });
});

describe('BeachList — suggestions', () => {
  async function typeSearch(term: string) {
    await renderList();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: term } });
    return input;
  }

  it('does not suggest with fewer than 2 characters', async () => {
    await typeSearch('l');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('suggests municipalities first and then beaches', async () => {
    // "su" matches the municipality Suances AND its beach La Concha: the
    // municipality (the broader answer) leads.
    await typeSearch('su');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.querySelector('.suggestion-name')?.textContent)).toEqual([
      'Suances',
      'La Concha',
    ]);
    // The municipality row says what it is and how many beaches it has.
    expect(options[0].querySelector('.suggestion-municipality')?.textContent).toContain(
      'Municipio',
    );
  });

  it('cuts at 5 suggestions even if there are more matches', async () => {
    await typeSearch('la');
    // "la" matches 6 beaches (see fixture), but only 5 are listed.
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });

  it('ArrowDown walks through the suggestions and wraps to the start', async () => {
    const input = await typeSearch('la');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    // The combobox tells assistive tech WHICH option is active.
    expect(input).toHaveAttribute('aria-activedescendant', 'suggestion-0');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('id', 'suggestion-0');

    for (let i = 0; i < 4; i += 1) fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[4]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp from the start jumps to the last one', async () => {
    const input = await typeSearch('la');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[4]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter on an active beach selects it and closes the list', async () => {
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

  it('Enter with no active suggestion selects nothing', async () => {
    const input = await typeSearch('la');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('la');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('Escape closes the list without changing the filter', async () => {
    const input = await typeSearch('la');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('la');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('blur closes the list after 150 ms', async () => {
    const input = await typeSearch('la');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.blur(input);
    // The close is deferred so that a click on a suggestion arrives first.
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('clicking a beach suggestion selects it', async () => {
    const input = await typeSearch('su');
    // Option 0 is the municipality Suances; option 1 is the beach.
    fireEvent.mouseDown(screen.getAllByRole('option')[1]);

    expect(input).toHaveValue('La Concha');
  });

  it('choosing a municipality navigates to its page', async () => {
    renderWithProviders(
      <>
        <BeachList />
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

describe('BeachList — webcam filter', () => {
  it('leaves only beaches with an active webcam and can be removed', async () => {
    const { container } = await renderList();
    const button = screen.getByRole('button', { name: 'Mostrar solo playas con webcam' });

    fireEvent.click(button);
    // La Salvé also has a webcam, but 'desactivada': it must stay out.
    expect(cardNames(container)).toEqual(['La Concha']);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);
    expect(cardNames(container)).toHaveLength(7);
  });
});

describe('BeachList — card badges', () => {
  it('marks as watched if there is idCruzRoja or Cruz Roja posts', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (name: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === name) as HTMLElement;

    // Laredo carries idCruzRoja: 310; El Sardinero, 101.
    expect(byName('Laredo').querySelector('.badge-lifeguarded')).not.toBeNull();
    expect(byName('El Sardinero').querySelector('.badge-lifeguarded')).not.toBeNull();
    // La Concha has two posts: watched no matter how the idCruzRoja comes in.
    expect(byName('La Concha').querySelector('.badge-lifeguarded')).not.toBeNull();
    // La Arnía has neither id nor posts: it is the real negative case.
    expect(byName('La Arnía').querySelector('.badge-lifeguarded')).toBeNull();
  });

  it('hides the webcam badge when it is disabled', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (name: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === name) as HTMLElement;

    expect(byName('La Concha').querySelector('.badge-webcam')).not.toBeNull();
    // La Salvé has a webcam with status 'desactivada'.
    expect(byName('La Salvé').querySelector('.badge-webcam')).toBeNull();
  });

  it('shows the Bandera Azul badge only on awarded beaches', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (name: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === name) as HTMLElement;

    // La Concha carries banderaAzul: 2026 in the fixture; La Salvé does not.
    expect(byName('La Concha').querySelector('.badge-flag-blue')).not.toBeNull();
    expect(byName('La Salvé').querySelector('.badge-flag-blue')).toBeNull();
  });

  it('each card says whether the beach is improving and why', async () => {
    const { container } = await renderList();
    const cards = Array.from(container.querySelectorAll('.beach-card'));
    const byName = (name: string) =>
      cards.find((c) => c.querySelector('.beach-card-name')?.textContent === name) as HTMLElement;

    const chip = byName('La Concha').querySelector('.trend-badge');
    expect(chip).toHaveTextContent('Está mejorando');
    expect(chip).toHaveTextContent('se despeja');
    // The backend already says it in razonRanking; with the chip it would be said twice.
    expect(byName('La Concha').querySelector('.beach-card-reason')).not.toHaveTextContent(
      'próximas horas',
    );

    // La Arnía comes as "estable": in a list that is a line of noise per
    // card, so it is not painted.
    expect(byName('La Arnía').querySelector('.trend-badge')).toBeNull();
  });

  it('shows at most 4 attribute icons', async () => {
    const { container } = await renderList();
    const laConcha = Array.from(container.querySelectorAll('.beach-card')).find(
      (c) => c.querySelector('.beach-card-name')?.textContent === 'La Concha',
    ) as HTMLElement;

    // La Concha has 6 active attributes in the fixture.
    expect(laConcha.querySelectorAll('.beach-attr-mini')).toHaveLength(4);
  });
});

describe('BeachList — sort by proximity', () => {
  it('does not offer proximity sort without a location', async () => {
    await renderList();
    expect(screen.queryByLabelText('Ordenar por cercanía')).not.toBeInTheDocument();
  });

  it('sorts by distance and shows the km when there is a location', async () => {
    setGeolocation([43.42, -3.43]); // next to Laredo
    const { container } = await renderList();

    fireEvent.click(screen.getByLabelText('Ordenar por cercanía'));

    expect(cardNames(container).slice(0, 2)).toEqual(['Laredo', 'La Salvé']);
    expect(container.querySelector('.beach-card-dist')).toHaveTextContent('· a 0 km');
  });

  it('the AZ button returns to alphabetical order', async () => {
    setGeolocation([43.42, -3.43]);
    const { container } = await renderList();

    fireEvent.click(screen.getByLabelText('Ordenar por cercanía'));
    fireEvent.click(screen.getByLabelText('Ordenar A-Z'));

    expect(cardNames(container)[0]).toBe('El Sardinero');
  });
});
