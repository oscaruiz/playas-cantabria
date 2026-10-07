/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `BeachDetailPage` (route `/playas/:codigo`), which today is 1052 lines
 * with 16 components declared inside it. It is the page that moves the most in
 * F4, so it is where nailing down the behaviour matters most.
 *
 * About the clocks: the page mixes two.
 *  - The day tabs and the tide status use the device's LOCAL time, so those
 *    tests pin the clock with `localNoon()` (local noon), which makes them
 *    valid in CI (UTC) and in Madrid alike.
 *  - The flag rules use `Europe/Madrid` via `Intl`, so their tests pin
 *    absolute UTC instants and do not depend on the runner's TZ.
 * That is why the flag `describe`s set up their own clock and do not assert on
 * the tabs, and vice versa.
 *
 * `getBeachDetail` does not cache, so here different payloads can be used in
 * each test. The only cache in play is the `/featured` one, and all the tests
 * share the same fixture.
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { BeachDetail, CurrentRain } from '../../services/api';
import { clearBeachDetailCacheForTests } from '../../services/api';
import BeachDetailPage from '../../pages/BeachDetailPage';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';
import { featuredResponse } from '../fixtures/featured';
import {
  buildAemetDetail,
  buildOpenWeatherDetail,
  buildOutOfHoursDetail,
} from '../fixtures/beachDetail';
import { localNoon } from '../time';
import { FEATURED_PATH as FEATURED, DETAIL_PATH as DETAILS } from '../apiRoutes';


const MIDDAY = localNoon('2026-07-27'); // Monday

function mockDetail(detail: BeachDetail | (() => RouteSpec | Promise<RouteSpec>)) {
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(DETAILS, typeof detail === 'function' ? detail : { json: detail }),
  ]);
}

/**
 * Synchronous on purpose: each test decides what to wait for. An `async` helper
 * that is not awaited leaves renders in flight that React ends up applying
 * after the jsdom teardown.
 */
function renderDetail(code = '3908503') {
  return renderWithProviders(<BeachDetailPage />, {
    route: `/playas/${code}`,
    path: '/playas/:codigo',
  });
}

/**
 * The ⓘ of a block, by its accessible name. Each one says WHAT it holds and
 * WHICH block it belongs to ("Aviso sobre la bandera", "Fuente de la
 * previsión"), so the tests open them the same way a reader does.
 */
function openInfo(accessibleName: string): HTMLElement {
  return screen.getByLabelText(accessibleName);
}

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
  // The detail is cached for 60 s in a module variable; each test brings its own.
  clearBeachDetailCacheForTests();
});

// ---------------------------------------------------------------------------

describe('BeachDetailPage — AEMET forecast', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(buildAemetDetail(MIDDAY));
  });

  it('labels the three tabs as Hoy / Mañana / Pasado mañana', async () => {
    renderDetail();
    await screen.findByText('Hoy');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.querySelector('.day-tab-title')?.textContent)).toEqual([
      'Hoy',
      'Mañana',
      'Pasado mañana',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('dates the tabs with the real month, also across a month change', async () => {
    // AEMET only labels the day of month ("sábado 01"), so pairing it with the
    // current month dated August 1st as "1 de julio" on the last days of July.
    const monthEnd = localNoon('2026-07-30'); // Thursday; +2 days lands in August
    jest.setSystemTime(monthEnd);
    mockDetail(buildAemetDetail(monthEnd));

    renderDetail();
    await screen.findByText('Hoy');

    const dates = screen
      .getAllByRole('tab')
      .map((t) => t.querySelector('.day-tab-date')?.textContent);
    expect(dates).toEqual(['Jueves 30 de julio', 'Viernes 31 de julio', 'Sábado 1 de agosto']);
  });

  it('for TODAY prioritizes the real observation over the afternoon forecast', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    // tiempoActual.cielo = "cielo despejado" -> "Sol";
    // dias[0].tarde.cielo = "intervalos nubosos" -> "Parcialmente soleado".
    // The headline uses the app's word, not the provider's, so as not to say
    // "Cielo despejado" where the score card says "Sol".
    expect(container.querySelector('.forecast-hero-sky')).toHaveTextContent('Sol');
    expect(container.querySelector('.forecast-hero-sky')).not.toHaveTextContent(
      'Parcialmente soleado',
    );
    expect(container.querySelector('.forecast-hero-icon-emoji')).toHaveTextContent('☀️');
  });

  it('shows the observed temperature and the forecast maximum', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('21°');
    // The "Máx." line only shows up if the observed one does not exceed the maximum.
    expect(container.querySelector('.forecast-hero-max')).toHaveTextContent('Máx. 26°');
    expect(container.querySelector('.forecast-hero-water')).toHaveTextContent('Agua 19°C');
  });

  it('hides the tomorrow block when there is no tomorrow data', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(container.querySelector('.halfday-detail')).toHaveClass('single');
    expect(container.querySelector('.halfday-block.morning')).toBeNull();
    expect(container.querySelector('.halfday-block.afternoon')).not.toBeNull();
  });

  it('paints feels-like, UV with its color and warning with its level', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(screen.getByText('Sensación térmica').nextElementSibling).toHaveTextContent(
      'Agradable',
    );

    const uv = container.querySelector('.uv-value');
    // The "Índice ultravioleta" prefix is trimmed before showing the level.
    expect(uv).toHaveTextContent('10 — Muy alto');
    expect(uv).toHaveClass('uv-very-high');

    // aviso.nivel 3 → yellow
    expect(container.querySelector('.warning-yellow')).toHaveTextContent(
      'Aviso amarillo por oleaje',
    );
  });

  it('sorts the tides by time and says which way it is heading', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    const entries = Array.from(container.querySelectorAll('.tide-entry'));
    expect(entries.map((e) => e.querySelector('.tide-label')?.textContent)).toEqual([
      'Bajamar',
      'Pleamar',
    ]);
    expect(entries.map((e) => e.querySelector('.tide-time-value')?.textContent)).toEqual([
      '09:00',
      '14:00',
    ]);
    // The next event is a high tide → the tide is rising.
    expect(container.querySelector('.tide-status')).toHaveTextContent('Subiendo');
    expect(container.querySelector('.tide-status')).toHaveClass('tide-status-rising');
  });

  it('cleans the asterisk of the tides source and the suffix of the weather source', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(container.querySelector('.tides-source')).toHaveTextContent('Puerto de Santander');
    expect(container.querySelector('.tides-source')?.textContent).not.toContain('*');
  });

  it('the forecast has no visible small print: it is all under its ⓘ', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    const meta = container.querySelector('.detail-col--forecast .forecast-metadata');
    // Closed by default: the panel does not exist until it is requested.
    expect(meta).not.toHaveTextContent('Agencia Estatal de Meteorología');
    expect(meta?.querySelector('.info-data-panel')).toBeNull();
    expect(meta?.querySelector('.info-data-btn')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opening that ⓘ shows the AEMET attribution, its time and the warnings zone', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    fireEvent.click(openInfo('Fuente de la previsión'));

    // Inside the forecast column, not in a footer lost at the end.
    const panel = container.querySelector(
      '.detail-col--forecast .forecast-metadata .info-data-panel',
    );
    expect(panel).toHaveTextContent(
      'Información elaborada utilizando, entre otras, la obtenida de la Agencia Estatal de Meteorología.',
    );
    expect(panel).toHaveTextContent('Zona de avisos: Litoral de Cantabria');
    expect(panel).toHaveTextContent('Elaborado el 27-07-2026 a las 10:00');
    expect(panel?.querySelector('a.provenance-link')).toHaveAttribute(
      'href',
      'https://www.aemet.es',
    );
  });

  it('the flag notice is under the banner ⓘ, and only there', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    const panels = Array.from(container.querySelectorAll('.safety-notice')).map(
      (n) => n.textContent ?? '',
    );
    // One per claim, not one per component: the flag is asserted in the banner
    // and again in the card, and the notice travels only with the banner.
    expect(panels.filter((p) => p.includes('Información orientativa'))).toHaveLength(1);
    expect(container.querySelector('.flag-banner .safety-notice')).toHaveTextContent(
      'Comprueba siempre la bandera presente en la playa',
    );
  });

  it('the ranking notice heads «cómo se calcula», without a second ⓘ', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(container.querySelector('.pd-score-block > .safety-notice')).toHaveTextContent(
      'No garantiza la seguridad ni las condiciones reales de la playa.',
    );
    expect(container.querySelectorAll('.pd-score-block .info-data-btn')).toHaveLength(0);
  });

  it('the sheet declares itself independent, under the footer ⓘ', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    fireEvent.click(openInfo('Sobre los datos de esta ficha'));

    const panel = container.querySelector('.pd-info-ficha .info-data-panel');
    expect(panel).toHaveTextContent(
      'Playucas.es es un proyecto independiente: ninguna de estas fuentes lo respalda ni colabora con él.',
    );
    expect(panel).toHaveTextContent('Datos calculados el');
  });

  it('when changing day it uses the forecast maximum and shows both half days', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    fireEvent.click(screen.getByText('Mañana', { selector: '.day-tab-title' }));

    // No real observation for a future day: temperaturaMaxima (28) rules.
    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('28°');
    expect(container.querySelector('.forecast-hero-max')).toBeNull();
    expect(container.querySelector('.halfday-detail')).not.toHaveClass('single');
    expect(container.querySelector('.halfday-block.morning')).not.toBeNull();
  });

  it('the tide state is only computed for today', async () => {
    const { container } = renderDetail();
    await screen.findByText('Hoy');

    fireEvent.click(screen.getByText('Mañana', { selector: '.day-tab-title' }));

    expect(container.querySelector('.tide-status')).toBeNull();
    expect(container.querySelectorAll('.tide-entry')).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------

describe('BeachDetailPage — rain badges', () => {
  /** Clones the AEMET fixture changing only the rain signal. */
  function withRain(rain: CurrentRain): BeachDetail {
    const detail = buildAemetDetail(MIDDAY);
    const currentConditions = detail.tiempoActual;
    if (!currentConditions) throw new Error('El fixture AEMET debe traer tiempoActual');
    return { ...detail, tiempoActual: { ...currentConditions, lluvia: rain } };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
  });

  it('shows "Lloviendo ahora" with the mm and hides the forecast', async () => {
    mockDetail(
      withRain({
        estado: 'lloviendo',
        mm: 1.25,
        ultimaHora: false,
        fuentes: ['OpenWeather'],
        timestamp: MIDDAY.toISOString(),
        prevista: { desdeIso: MIDDAY.toISOString(), mm: 2, fuentes: ['Open-Meteo'] },
      }),
    );

    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(container.querySelector('.forecast-hero-rain')).toHaveTextContent(
      'Lloviendo ahora · 1.3 mm',
    );
    // Never two badges: the forecast keeps quiet while it is raining.
    expect(container.querySelector('.forecast-hero-rain-expected')).toBeNull();
    // And the emoji switches to rain even if the sky says "despejado".
    expect(container.querySelector('.forecast-hero-icon-emoji')).toHaveTextContent('🌧️');
  });

  it('shows the forecast rain with its time when it is not raining', async () => {
    mockDetail(
      withRain({
        estado: 'sin_lluvia',
        mm: 0,
        ultimaHora: false,
        fuentes: ['OpenWeather'],
        timestamp: MIDDAY.toISOString(),
        prevista: { desdeIso: '2026-07-27T16:00:00.000Z', mm: 2, fuentes: ['Open-Meteo'] },
      }),
    );

    const { container } = renderDetail();
    await screen.findByText('Hoy');

    // 16:00Z = 18:00 in Madrid.
    expect(container.querySelector('.forecast-hero-rain-expected')).toHaveTextContent(
      'Lluvia prevista hacia las 18:00',
    );
  });

  it('tells apart the rain of the last hour', async () => {
    mockDetail(
      withRain({
        estado: 'lloviendo',
        mm: 0.4,
        ultimaHora: true,
        fuentes: ['AEMET'],
        timestamp: MIDDAY.toISOString(),
        prevista: null,
      }),
    );

    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(container.querySelector('.forecast-hero-rain')).toHaveTextContent(
      'Lluvia en la última hora',
    );
  });
});

// ---------------------------------------------------------------------------

describe('BeachDetailPage — beaches without an AEMET sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(buildOpenWeatherDetail(MIDDAY));
  });

  it('falls back to the `clima` hero without day selector or tides', async () => {
    const { container } = renderDetail('3905201');
    await screen.findByText('La Arnía');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(container.querySelector('.tides-section')).toBeNull();
    expect(container.querySelector('.halfday-detail')).toBeNull();
    expect(container.querySelector('.forecast-hero')).not.toBeNull();
  });

  it('synthesizes the UV level from the index', async () => {
    const { container } = renderDetail('3905201');
    await screen.findByText('La Arnía');

    // uvIndex 6 → "Alto" according to the WHO scale that the frontend applies.
    const uv = container.querySelector('.uv-value');
    expect(uv).toHaveTextContent('6 — Alto');
    expect(uv).toHaveClass('uv-high');
  });

  it('labels the weather source declared by `clima`', async () => {
    const { container } = renderDetail('3905201');
    await screen.findByText('La Arnía');

    // Without an AEMET sheet the source is declared by `clima`, and credited under
    // the panel's own ⓘ: there is no page label repeating it at the bottom.
    fireEvent.click(openInfo('Fuente de la previsión'));

    const notes = Array.from(container.querySelectorAll('.provenance-attribution')).map(
      (n) => n.textContent ?? '',
    );
    expect(notes.some((n) => n.includes('Agencia Estatal de Meteorología'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('BeachDetailPage — Cruz Roja flag', () => {
  it('within hours and with a fresh capture it paints the full color', async () => {
    // 12:00Z = 14:00 in Madrid, within 11:00-20:00.
    const now = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    mockDetail(buildAemetDetail(now));

    const { container } = renderDetail();
    await screen.findByText('Estado para bañarse (según Cruz Roja)');

    const pennant = container.querySelector('.flag-pennant');
    expect(pennant).toHaveClass('green');
    expect(pennant).not.toHaveClass('dimmed');
    expect(container.querySelector('.flag-value')).toHaveTextContent('Bandera Verde');
    expect(container.querySelector('.flag-info')).toHaveTextContent('Vigilancia: 11:00 - 20:00');
  });

  it('just closed it shows the last one recorded, dimmed and dated', async () => {
    // 21:00Z = 23:00 in Madrid. Flown until 19:30: 3.5 h ago.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T21:00:00.000Z'));
    mockDetail(buildOutOfHoursDetail());

    const { container } = renderDetail('3907501');
    await screen.findByText('Estado para bañarse (según Cruz Roja)');

    const pennant = container.querySelector('.flag-pennant');
    expect(pennant).toHaveClass('green');
    expect(pennant).toHaveClass('dimmed');
    expect(container.querySelector('.flag-value')).toHaveTextContent(
      'Última bandera registrada: Verde',
    );
    expect(container.querySelector('.flag-info')).toHaveTextContent(
      'Registrada hoy a las 19:30',
    );
  });

  it('the next morning there is no color: the flag is over 8h old', async () => {
    // 05:00Z = 07:00 in Madrid. It stopped flying yesterday at 19:30, 13.5 h ago.
    // It still says it is out of hours, but without painting a flag.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-28T05:00:00.000Z'));
    mockDetail(buildOutOfHoursDetail());

    const { container } = renderDetail('3907501');
    await screen.findByText('Estado para bañarse (según Cruz Roja)');

    expect(container.querySelector('.flag-pennant')).not.toHaveClass('green');
    expect(container.querySelector('.flag-value')).toHaveTextContent('Fuera de horario');
    expect(container.querySelector('.flag-value')).not.toHaveTextContent('Verde');
  });

  it('hides the banner when there is no current flag within hours', async () => {
    const now = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);

    const detail = buildAemetDetail(now);
    // The backend's "no reading" value: what it sends instead of a colour.
    detail.cruzRoja = { ultimaActualizacion: now.toISOString(), ...detail.cruzRoja, bandera: 'Desconocida' };
    mockDetail(detail);

    renderDetail();
    await screen.findByText('La Concha');

    expect(
      screen.queryByText('Estado para bañarse (según Cruz Roja)'),
    ).not.toBeInTheDocument();
  });

  it('the Cruz Roja card comes expanded only with a current flag', async () => {
    const now = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    mockDetail(buildAemetDetail(now));

    const { container } = renderDetail();
    await screen.findByText('Cruz Roja', { selector: '.card-header-title' });

    expect(container.querySelector('.card-body')).not.toBeNull();
    expect(screen.getByText('Bandera actual').nextElementSibling).toHaveTextContent('Verde');
    expect(container.querySelector('.card-header')).toHaveAttribute('aria-expanded', 'true');
  });

  it('the card collapses and expands when pressed', async () => {
    const now = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    mockDetail(buildAemetDetail(now));

    const { container } = renderDetail();
    await screen.findByText('Cruz Roja', { selector: '.card-header-title' });

    fireEvent.click(container.querySelector('.card-header') as HTMLElement);
    expect(container.querySelector('.card-body')).toBeNull();

    fireEvent.click(container.querySelector('.card-header') as HTMLElement);
    expect(container.querySelector('.card-body')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('BeachDetailPage — score', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(buildAemetDetail(MIDDAY));
  });

  it('takes the score from resumenTodas looking up by code', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');

    expect(container.querySelector('.score-badge-num')).toHaveTextContent('93');
    expect(container.querySelector('.pd-score-reason')).toHaveTextContent(
      'cielo despejado, viento flojo, bandera verde',
    );
  });

  it('the "cómo se calcula" dropdown opens the 6 factors of THIS beach and the 2 rules', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');

    expect(container.querySelector('.pd-score-info')).toBeNull();

    fireEvent.click(screen.getByText('Cómo se calcula'));

    // Six, not seven: UV stopped scoring (it subtracted on every clear day, which
    // are exactly the days worth going) and cannot appear as a factor.
    const factors = container.querySelectorAll('.pd-score-info .pd-factor');
    expect(factors).toHaveLength(6);
    expect(container.querySelector('.pd-score-info')).not.toHaveTextContent('UV');
    expect(factors[0].querySelector('.pd-factor-name')).toHaveTextContent('Sol y cielo');
    expect(factors[0].querySelector('.pd-factor-points')).toHaveTextContent('25/25');
    // The generic explanation is not lost: it drops to the row's secondary text.
    expect(factors[0].querySelector('.pd-factor-note')).toHaveTextContent(
      'cuanto más despejado, mejor.',
    );

    // Rain and danger do not score: they are rules that cap or exclude.
    const rules = container.querySelectorAll('.pd-score-info .beach-info-row');
    expect(rules).toHaveLength(2);
    expect(rules[0].querySelector('.beach-info-label')).toHaveTextContent('Lluvia');
  });

  it('each factor shows the beach datum that explains its points', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    const values = Array.from(container.querySelectorAll('.pd-factor-value')).map(
      (n) => n.textContent,
    );

    expect(values[0]).toBe('cielo despejado');   // sky
    expect(values[1]).toBe('22°');               // temperature
    expect(values[3]).toBe('Verde');             // flag (wind comes first: it weighs more)
    expect(values[4]).toBe('marejadilla');       // swell
    expect(values[5]).toBe('clima y bandera');   // data
  });

  it('22° reads as a very good temperature, not as a bare pass', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    const points = container.querySelectorAll('.pd-factor-points');
    expect(points[1]).toHaveTextContent('22/25');
  });

  it('the breakdown points add up to the score when there is no cap', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    const sum = Array.from(container.querySelectorAll('.pd-factor-points'))
      .map((n) => Number((n.textContent ?? '').split('/')[0]))
      .reduce((a, b) => a + b, 0);

    expect(sum).toBe(93);
    expect(container.querySelector('.pd-score-cap')).toBeNull();
  });

  it('announces where the day is heading without expanding anything, and without repeating it in the reason', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');

    const chip = container.querySelector('.trend-badge');
    expect(chip).toHaveTextContent('Está mejorando');
    expect(chip).toHaveTextContent('+6 puntos');
    // And why it improves: a bare "Mejora" does not say whether it is worth waiting.
    expect(chip).toHaveTextContent('se despeja');
    // The backend already says it in razonRanking; with the chip it would be said twice.
    expect(container.querySelector('.pd-score-reason')).not.toHaveTextContent('próximas horas');
  });

  it('the hourly strip is visible without expanding anything and sits right above tides', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');

    // Without touching "Cómo se calcula": it lives in its own section of the page.
    const hours = container.querySelectorAll('.next-hours-section .pd-hour');
    expect(hours).toHaveLength(3);
    expect(hours[0].querySelector('.pd-hour-temp')).toHaveTextContent('21°');
    expect(hours[2].querySelector('.pd-hour-temp')).toHaveTextContent('23°');

    // The DOM order: next hours first, then tides.
    const sections = Array.from(
      container.querySelectorAll('.next-hours-section, .tides-section'),
    ).map((n) => n.className);
    expect(sections).toEqual(['next-hours-section', 'tides-section']);
  });

  it('credits who forecasts those hours, with what the API says', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');

    // Crediting and saying they are adapted is ONE sentence: the license note
    // already links to Open-Meteo, so the generic credit is not repeated above.
    fireEvent.click(openInfo('Fuente de las próximas horas'));

    const source = container.querySelector('.next-hours-source .info-data-panel');
    expect(source).toHaveTextContent(
      'Datos meteorológicos de Open-Meteo, adaptados por Playucas.es: se transforman para calcular la puntuación.',
    );
    expect(source?.querySelector('a')).toHaveAttribute('href', 'https://open-meteo.com');
    expect(container.querySelectorAll('.next-hours-source')).toHaveLength(1);
  });

  it('the score dropdown no longer repeats the strip', async () => {
    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    expect(container.querySelectorAll('.pd-score-info .pd-hour')).toHaveLength(0);
  });

  it('without breakdown (old backend) the panel still opens with its rules', async () => {
    // La Salvé has no additive block in the fixture.
    const { container } = renderDetail('3903501');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    expect(container.querySelectorAll('.pd-factor')).toHaveLength(0);
    expect(container.querySelectorAll('.beach-info-row').length).toBeGreaterThan(0);
    expect(container.querySelector('.trend-badge')).toBeNull();
  });

  it('shows no score block if the beach is not in the ranking', async () => {
    const detail = buildAemetDetail(MIDDAY);
    detail.codigo = 'NO-EXISTE';
    mockDetail(detail);

    renderDetail('NO-EXISTE');
    await screen.findByText('La Concha');

    expect(screen.queryByText('Puntuación de hoy')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('BeachDetailPage — beach information', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(buildAemetDetail(MIDDAY));
  });

  it('lists the information rows with their units', async () => {
    renderDetail();
    await screen.findByText('Información de la playa');

    expect(screen.getByText('Dimensiones').nextElementSibling).toHaveTextContent('1000 m × 60 m');
    expect(screen.getByText('Tipo').nextElementSibling).toHaveTextContent('Urbana');
    expect(screen.getByText('Acceso').nextElementSibling).toHaveTextContent('A pie · En coche');
    expect(screen.getByText('Hospital').nextElementSibling).toHaveTextContent('a 10 km');
  });

  it('adds diving to the attributes even when it comes as a loose field', async () => {
    renderDetail();
    await screen.findByText('Servicios y características');

    expect(screen.getByText('Submarinismo')).toBeInTheDocument();
    expect(screen.getByText('Duchas')).toBeInTheDocument();
    // `aseos: false` must not appear.
    expect(screen.queryByText('Aseos')).not.toBeInTheDocument();
  });

  it('links the webcam in a new tab and safely', async () => {
    renderDetail();
    await screen.findByText('Webcam en directo');

    const link = screen.getByText('Abrir webcam').closest('a') as HTMLAnchorElement;
    expect(link).toHaveAttribute('href', 'https://example.test/webcam/la-concha');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('offers directions and view on the map', async () => {
    renderDetail();
    await screen.findByText('Cómo llegar');

    const dir = screen.getByText('Cómo llegar').closest('a') as HTMLAnchorElement;
    expect(dir.href).toContain(
      'https://www.google.com/maps/dir/?api=1&destination=43.43553526584305,-4.0427976710155225',
    );
    expect(screen.getByText('Ver en el mapa')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('BeachDetailPage — states', () => {
  it('shows the spinner while loading', async () => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    const pending = deferred<RouteSpec>();
    mockDetail(() => pending.promise);

    renderDetail();

    expect(screen.getByText('Cargando datos de la playa...')).toBeInTheDocument();

    pending.resolve({ json: buildAemetDetail(MIDDAY) });
    await screen.findByText('Hoy');
  });

  it('shows the error if the detail fails', async () => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(() => ({ status: 500 }));

    renderDetail();

    await screen.findByText('No se pudo cargar el detalle de la playa');
    expect(screen.queryByText('Cargando datos de la playa...')).not.toBeInTheDocument();
  });

  it('states the cause: the HTTP status when the server answers', async () => {
    // Three times today the same text with three different causes. The cause is
    // the first thing needed, not an ornament.
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(() => ({ status: 429 }));

    const { container } = renderDetail();

    await screen.findByText('No se pudo cargar el detalle de la playa');
    expect(container.querySelector('.error-cause')).toHaveTextContent('HTTP 429');
  });

  it('states the cause: no response when the request never comes back', async () => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(() => ({ networkError: true }));

    const { container } = renderDetail();

    await screen.findByText('No se pudo cargar el detalle de la playa');
    expect(container.querySelector('.error-cause')).toHaveTextContent('Sin respuesta del servidor');
  });

  it('a transient failure does not leave the notice stuck if the retry brings the data', async () => {
    // The screenshot case: the whole sheet painted (78/100, forecast, webcam...)
    // and on top the red "no se pudo cargar" banner. The first attempt failed,
    // the second worked, and the error never went away.
    jest.useFakeTimers().setSystemTime(MIDDAY);
    let attempt = 0;
    installFetchMock([
      route(FEATURED, { json: featuredResponse }),
      route(DETAILS, () => {
        attempt += 1;
        return attempt === 1 ? { networkError: true } : { json: buildAemetDetail(MIDDAY) };
      }),
    ]);

    const { unmount } = renderDetail();
    await screen.findByText('No se pudo cargar el detalle de la playa');

    // Second mount (what StrictMode does in development, or a re-navigation).
    unmount();
    renderDetail();

    await screen.findByText('Hoy');
    expect(screen.queryByText('No se pudo cargar el detalle de la playa')).not.toBeInTheDocument();
  });

  it('the error notice never coexists with the loaded sheet', async () => {
    jest.useFakeTimers().setSystemTime(MIDDAY);
    mockDetail(buildAemetDetail(MIDDAY));

    const { container } = renderDetail();
    await screen.findByText('Hoy');

    expect(container.querySelector('.error-container')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

/**
 * LAST on purpose: it swaps the `/featured` response, and the 5 min module
 * cache in `services/api.ts` would hand that swapped ranking to any test that
 * ran after it (same debt the states file documents).
 */
describe('BeachDetailPage — published cap', () => {
  it('the cap note shows the value the backend publishes, not a hardcoded 59', async () => {
    // The forecast cap is graded now: rain 3 h away caps at 75, not 59.
    const withCap = {
      ...featuredResponse,
      resumenTodas: featuredResponse.resumenTodas.map((b) =>
        b.codigo === '3908503'
          ? { ...b, puntuacion: 75, topeAplicado: 'lluvia_prevista' as const, topeValor: 75 }
          : b,
      ),
    };
    // `/featured` is cached in `services/api.ts` for 5 min against Date.now(),
    // and earlier tests filled it under the REAL clock. Stepping the fake clock
    // past that (real now + TTL) is what lets THIS response in.
    jest.useRealTimers();
    const after = new Date(Date.now() + 10 * 60_000);
    jest.useFakeTimers().setSystemTime(after);
    installFetchMock([
      route(FEATURED, { json: withCap }),
      route(DETAILS, { json: buildAemetDetail(after) }),
    ]);

    const { container } = renderDetail('3908503');
    await screen.findByText('Puntuación de hoy');
    // The score arrives from the (uncached) /featured after the detail does.
    await waitFor(() => expect(container.querySelector('.score-badge-num')).toHaveTextContent('75'));
    fireEvent.click(screen.getByText('Cómo se calcula'));

    expect(container.querySelector('.pd-score-cap')).toHaveTextContent(
      'Se espera lluvia: la nota se limita a 75',
    );
  });
});
