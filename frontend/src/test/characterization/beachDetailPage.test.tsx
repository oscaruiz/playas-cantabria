/**
 * CHARACTERIZATION — FROZEN.
 *
 * Pins down `PlayaDetalle` (route `/playas/:codigo`), which today is 1052 lines
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
 * `getDetallePlaya` does not cache, so here different payloads can be used in
 * each test. The only cache in play is the `/featured` one, and all the tests
 * share the same fixture.
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { PlayaDetalle, LluviaActual } from '../../services/api';
import PlayaDetallePage from '../../pages/PlayaDetalle';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';
import { featuredResponse } from '../fixtures/featured';
import {
  buildAemetDetail,
  buildOpenWeatherDetail,
  buildOutOfHoursDetail,
} from '../fixtures/beachDetail';
import { localNoon } from '../time';
import { RUTA_DESTACADAS as FEATURED, RUTA_DETALLE as DETAILS } from '../apiRoutes';


const MEDIODIA = localNoon('2026-07-27'); // Monday

function mockDetalle(detalle: PlayaDetalle | (() => RouteSpec | Promise<RouteSpec>)) {
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(DETAILS, typeof detalle === 'function' ? detalle : { json: detalle }),
  ]);
}

/**
 * Synchronous on purpose: each test decides what to wait for. An `async` helper
 * that is not awaited leaves renders in flight that React ends up applying
 * after the jsdom teardown.
 */
function renderDetalle(codigo = '3908503') {
  return renderWithProviders(<PlayaDetallePage />, {
    route: `/playas/${codigo}`,
    path: '/playas/:codigo',
  });
}

/**
 * The ⓘ of a block, by its accessible name. Each one says WHAT it holds and
 * WHICH block it belongs to ("Aviso sobre la bandera", "Fuente de la
 * previsión"), so the tests open them the same way a reader does.
 */
function abrirInfo(nombreAccesible: string): HTMLElement {
  return screen.getByLabelText(nombreAccesible);
}

afterEach(() => {
  restoreFetch();
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — previsión AEMET', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(buildAemetDetail(MEDIODIA));
  });

  it('rotula las tres pestañas como Hoy / Mañana / Pasado mañana', async () => {
    renderDetalle();
    await screen.findByText('Hoy');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.querySelector('.day-tab-title')?.textContent)).toEqual([
      'Hoy',
      'Mañana',
      'Pasado mañana',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('fecha las pestañas con el mes real, también al cambiar de mes', async () => {
    // AEMET only labels the day of month ("sábado 01"), so pairing it with the
    // current month dated August 1st as "1 de julio" on the last days of July.
    const finDeMes = localNoon('2026-07-30'); // Thursday; +2 days lands in August
    jest.setSystemTime(finDeMes);
    mockDetalle(buildAemetDetail(finDeMes));

    renderDetalle();
    await screen.findByText('Hoy');

    const fechas = screen
      .getAllByRole('tab')
      .map((t) => t.querySelector('.day-tab-date')?.textContent);
    expect(fechas).toEqual(['Jueves 30 de julio', 'Viernes 31 de julio', 'Sábado 1 de agosto']);
  });

  it('para HOY prioriza la observación real sobre la previsión de la tarde', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    // tiempoActual.cielo = "cielo despejado" -> "Sol";
    // dias[0].tarde.cielo = "intervalos nubosos" -> "Parcialmente soleado".
    // El titular usa la palabra de la app, no la del proveedor, para no decir
    // "Cielo despejado" donde la tarjeta de puntuación dice "Sol".
    expect(container.querySelector('.forecast-hero-sky')).toHaveTextContent('Sol');
    expect(container.querySelector('.forecast-hero-sky')).not.toHaveTextContent(
      'Parcialmente soleado',
    );
    expect(container.querySelector('.forecast-hero-icon-emoji')).toHaveTextContent('☀️');
  });

  it('muestra la temperatura observada y la máxima prevista', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('21°');
    // The "Máx." line only shows up if the observed one does not exceed the maximum.
    expect(container.querySelector('.forecast-hero-max')).toHaveTextContent('Máx. 26°');
    expect(container.querySelector('.forecast-hero-agua')).toHaveTextContent('Agua 19°C');
  });

  it('oculta el bloque de mañana cuando no hay datos de mañana', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.halfday-detail')).toHaveClass('single');
    expect(container.querySelector('.halfday-block.morning')).toBeNull();
    expect(container.querySelector('.halfday-block.afternoon')).not.toBeNull();
  });

  it('pinta sensación, UV con su color y aviso con su nivel', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(screen.getByText('Sensación térmica').nextElementSibling).toHaveTextContent(
      'Agradable',
    );

    const uv = container.querySelector('.uv-value');
    // The "Índice ultravioleta" prefix is trimmed before showing the level.
    expect(uv).toHaveTextContent('10 — Muy alto');
    expect(uv).toHaveClass('uv-very-high');

    // aviso.nivel 3 → yellow
    expect(container.querySelector('.aviso-yellow')).toHaveTextContent(
      'Aviso amarillo por oleaje',
    );
  });

  it('ordena las mareas por hora e indica hacia dónde va', async () => {
    const { container } = renderDetalle();
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

  it('limpia el asterisco de la fuente de mareas y el sufijo de la fuente meteo', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.tides-source')).toHaveTextContent('Puerto de Santander');
    expect(container.querySelector('.tides-source')?.textContent).not.toContain('*');
  });

  it('la previsión no lleva letra pequeña a la vista: va toda bajo su ⓘ', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    const meta = container.querySelector('.detail-col--forecast .forecast-metadata');
    // Cerrada por defecto: el panel no existe hasta que se pide.
    expect(meta).not.toHaveTextContent('Agencia Estatal de Meteorología');
    expect(meta?.querySelector('.info-datos-panel')).toBeNull();
    expect(meta?.querySelector('.info-datos-btn')).toHaveAttribute('aria-expanded', 'false');
  });

  it('al abrir esa ⓘ salen la atribución de AEMET, su hora y la zona de avisos', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    fireEvent.click(abrirInfo('Fuente de la previsión'));

    // Dentro de la columna de la previsión, no en un pie perdido al final.
    const panel = container.querySelector(
      '.detail-col--forecast .forecast-metadata .info-datos-panel',
    );
    expect(panel).toHaveTextContent(
      'Información elaborada utilizando, entre otras, la obtenida de la Agencia Estatal de Meteorología.',
    );
    expect(panel).toHaveTextContent('Zona de avisos: Litoral de Cantabria');
    expect(panel).toHaveTextContent('Elaborado el 27-07-2026 a las 10:00');
    expect(panel?.querySelector('a.procedencia-enlace')).toHaveAttribute(
      'href',
      'https://www.aemet.es',
    );
  });

  it('el aviso de la bandera está bajo la ⓘ del banner, y solo ahí', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    const paneles = Array.from(container.querySelectorAll('.safety-notice')).map(
      (n) => n.textContent ?? '',
    );
    // Uno por afirmación, no uno por componente: la bandera se afirma en el
    // banner y otra vez en la tarjeta, y el aviso viaja solo con el banner.
    expect(paneles.filter((p) => p.includes('Información orientativa'))).toHaveLength(1);
    expect(container.querySelector('.flag-banner .safety-notice')).toHaveTextContent(
      'Comprueba siempre la bandera presente en la playa',
    );
  });

  it('el aviso del ranking encabeza «cómo se calcula», sin una segunda ⓘ', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.pd-score-block > .safety-notice')).toHaveTextContent(
      'No garantiza la seguridad ni las condiciones reales de la playa.',
    );
    expect(container.querySelectorAll('.pd-score-block .info-datos-btn')).toHaveLength(0);
  });

  it('la ficha se declara independiente, bajo la ⓘ del pie', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    fireEvent.click(abrirInfo('Sobre los datos de esta ficha'));

    const panel = container.querySelector('.pd-info-ficha .info-datos-panel');
    expect(panel).toHaveTextContent(
      'Playucas.es es un proyecto independiente: ninguna de estas fuentes lo respalda ni colabora con él.',
    );
    expect(panel).toHaveTextContent('Datos calculados el');
  });

  it('al cambiar de día usa la máxima prevista y muestra los dos medios días', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    fireEvent.click(screen.getByText('Mañana', { selector: '.day-tab-title' }));

    // No real observation for a future day: temperaturaMaxima (28) rules.
    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('28°');
    expect(container.querySelector('.forecast-hero-max')).toBeNull();
    expect(container.querySelector('.halfday-detail')).not.toHaveClass('single');
    expect(container.querySelector('.halfday-block.morning')).not.toBeNull();
  });

  it('el estado de la marea solo se calcula para el día de hoy', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    fireEvent.click(screen.getByText('Mañana', { selector: '.day-tab-title' }));

    expect(container.querySelector('.tide-status')).toBeNull();
    expect(container.querySelectorAll('.tide-entry')).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — badges de lluvia', () => {
  /** Clones the AEMET fixture changing only the rain signal. */
  function conLluvia(lluvia: LluviaActual): PlayaDetalle {
    const detalle = buildAemetDetail(MEDIODIA);
    const tiempoActual = detalle.tiempoActual;
    if (!tiempoActual) throw new Error('El fixture AEMET debe traer tiempoActual');
    return { ...detalle, tiempoActual: { ...tiempoActual, lluvia } };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
  });

  it('muestra "Lloviendo ahora" con los mm y oculta la previsión', async () => {
    mockDetalle(
      conLluvia({
        estado: 'lloviendo',
        mm: 1.25,
        ultimaHora: false,
        fuentes: ['OpenWeather'],
        timestamp: MEDIODIA.toISOString(),
        prevista: { desdeIso: MEDIODIA.toISOString(), mm: 2, fuentes: ['Open-Meteo'] },
      }),
    );

    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.forecast-hero-lluvia')).toHaveTextContent(
      'Lloviendo ahora · 1.3 mm',
    );
    // Never two badges: the forecast keeps quiet while it is raining.
    expect(container.querySelector('.forecast-hero-lluvia-prevista')).toBeNull();
    // And the emoji switches to rain even if the sky says "despejado".
    expect(container.querySelector('.forecast-hero-icon-emoji')).toHaveTextContent('🌧️');
  });

  it('muestra la lluvia prevista con su hora cuando no llueve', async () => {
    mockDetalle(
      conLluvia({
        estado: 'sin_lluvia',
        mm: 0,
        ultimaHora: false,
        fuentes: ['OpenWeather'],
        timestamp: MEDIODIA.toISOString(),
        prevista: { desdeIso: '2026-07-27T16:00:00.000Z', mm: 2, fuentes: ['Open-Meteo'] },
      }),
    );

    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    // 16:00Z = 18:00 in Madrid.
    expect(container.querySelector('.forecast-hero-lluvia-prevista')).toHaveTextContent(
      'Lluvia prevista hacia las 18:00',
    );
  });

  it('distingue la lluvia de la última hora', async () => {
    mockDetalle(
      conLluvia({
        estado: 'lloviendo',
        mm: 0.4,
        ultimaHora: true,
        fuentes: ['AEMET'],
        timestamp: MEDIODIA.toISOString(),
        prevista: null,
      }),
    );

    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.forecast-hero-lluvia')).toHaveTextContent(
      'Lluvia en la última hora',
    );
  });
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — playas sin ficha AEMET', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(buildOpenWeatherDetail(MEDIODIA));
  });

  it('cae al hero de `clima` sin selector de días ni mareas', async () => {
    const { container } = renderDetalle('3905201');
    await screen.findByText('La Arnía');

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(container.querySelector('.tides-section')).toBeNull();
    expect(container.querySelector('.halfday-detail')).toBeNull();
    expect(container.querySelector('.forecast-hero')).not.toBeNull();
  });

  it('sintetiza el nivel de UV a partir del índice', async () => {
    const { container } = renderDetalle('3905201');
    await screen.findByText('La Arnía');

    // uvIndex 6 → "Alto" according to the WHO scale that the frontend applies.
    const uv = container.querySelector('.uv-value');
    expect(uv).toHaveTextContent('6 — Alto');
    expect(uv).toHaveClass('uv-high');
  });

  it('etiqueta la fuente meteorológica declarada por `clima`', async () => {
    const { container } = renderDetalle('3905201');
    await screen.findByText('La Arnía');

    // Sin hoja de AEMET la fuente la declara `clima`, y se acredita bajo la ⓘ
    // del propio panel: no hay una etiqueta de página que lo repita al pie.
    fireEvent.click(abrirInfo('Fuente de la previsión'));

    const notas = Array.from(container.querySelectorAll('.procedencia-atribucion')).map(
      (n) => n.textContent ?? '',
    );
    expect(notas.some((n) => n.includes('Agencia Estatal de Meteorología'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — bandera de Cruz Roja', () => {
  it('dentro de horario y con captura fresca pinta el color pleno', async () => {
    // 12:00Z = 14:00 in Madrid, within 11:00-20:00.
    const ahora = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(ahora);
    mockDetalle(buildAemetDetail(ahora));

    const { container } = renderDetalle();
    await screen.findByText('Estado para bañarse (según Cruz Roja)');

    const pennant = container.querySelector('.flag-pennant');
    expect(pennant).toHaveClass('green');
    expect(pennant).not.toHaveClass('atenuada');
    expect(container.querySelector('.flag-value')).toHaveTextContent('Bandera Verde');
    expect(container.querySelector('.flag-info')).toHaveTextContent('Vigilancia: 11:00 - 20:00');
  });

  it('recién cerrado enseña la última registrada, atenuada y fechada', async () => {
    // 21:00Z = 23:00 en Madrid. Izada hasta las 19:30: hace 3,5 h.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-27T21:00:00.000Z'));
    mockDetalle(buildOutOfHoursDetail());

    const { container } = renderDetalle('3907501');
    await screen.findByText('Estado para bañarse (según Cruz Roja)');

    const pennant = container.querySelector('.flag-pennant');
    expect(pennant).toHaveClass('green');
    expect(pennant).toHaveClass('atenuada');
    expect(container.querySelector('.flag-value')).toHaveTextContent(
      'Última bandera registrada: Verde',
    );
    expect(container.querySelector('.flag-info')).toHaveTextContent(
      'Registrada hoy a las 19:30',
    );
  });

  it('a la mañana siguiente ya no hay color: la bandera pasa de 8h', async () => {
    // 05:00Z = 07:00 en Madrid. Dejó de ondear ayer a las 19:30, hace 13,5 h.
    // Se sigue diciendo que está fuera de horario, pero sin pintar bandera.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-28T05:00:00.000Z'));
    mockDetalle(buildOutOfHoursDetail());

    const { container } = renderDetalle('3907501');
    await screen.findByText('Estado para bañarse (según Cruz Roja)');

    expect(container.querySelector('.flag-pennant')).not.toHaveClass('green');
    expect(container.querySelector('.flag-value')).toHaveTextContent('Fuera de horario');
    expect(container.querySelector('.flag-value')).not.toHaveTextContent('Verde');
  });

  it('oculta el banner cuando no hay bandera vigente dentro de horario', async () => {
    const ahora = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(ahora);

    const detalle = buildAemetDetail(ahora);
    detalle.cruzRoja = { ...detalle.cruzRoja, bandera: undefined };
    mockDetalle(detalle);

    renderDetalle();
    await screen.findByText('La Concha');

    expect(
      screen.queryByText('Estado para bañarse (según Cruz Roja)'),
    ).not.toBeInTheDocument();
  });

  it('la tarjeta de Cruz Roja viene desplegada solo con bandera vigente', async () => {
    const ahora = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(ahora);
    mockDetalle(buildAemetDetail(ahora));

    const { container } = renderDetalle();
    await screen.findByText('Cruz Roja', { selector: '.card-header-title' });

    expect(container.querySelector('.card-body')).not.toBeNull();
    expect(screen.getByText('Bandera actual').nextElementSibling).toHaveTextContent('Verde');
    expect(container.querySelector('.card-header')).toHaveAttribute('aria-expanded', 'true');
  });

  it('la tarjeta se pliega y despliega al pulsarla', async () => {
    const ahora = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(ahora);
    mockDetalle(buildAemetDetail(ahora));

    const { container } = renderDetalle();
    await screen.findByText('Cruz Roja', { selector: '.card-header-title' });

    fireEvent.click(container.querySelector('.card-header') as HTMLElement);
    expect(container.querySelector('.card-body')).toBeNull();

    fireEvent.click(container.querySelector('.card-header') as HTMLElement);
    expect(container.querySelector('.card-body')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — puntuación', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(buildAemetDetail(MEDIODIA));
  });

  it('toma la puntuación de resumenTodas buscando por código', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');

    expect(container.querySelector('.score-badge-num')).toHaveTextContent('93');
    expect(container.querySelector('.pd-score-reason')).toHaveTextContent(
      'cielo despejado, viento flojo, bandera verde',
    );
  });

  it('el desplegable "cómo se calcula" abre los 6 factores de ESTA playa y las 2 reglas', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');

    expect(container.querySelector('.pd-score-info')).toBeNull();

    fireEvent.click(screen.getByText('Cómo se calcula'));

    // Seis, no siete: el UV dejó de puntuar (restaba en todo día despejado, que
    // son justo los días que merece la pena ir) y no puede figurar como factor.
    const factores = container.querySelectorAll('.pd-score-info .pd-factor');
    expect(factores).toHaveLength(6);
    expect(container.querySelector('.pd-score-info')).not.toHaveTextContent('UV');
    expect(factores[0].querySelector('.pd-factor-nombre')).toHaveTextContent('Sol y cielo');
    expect(factores[0].querySelector('.pd-factor-puntos')).toHaveTextContent('25/25');
    // La explicación genérica no se pierde: baja a texto secundario de la fila.
    expect(factores[0].querySelector('.pd-factor-nota')).toHaveTextContent(
      'cuanto más despejado, mejor.',
    );

    // Lluvia y peligro no puntúan: son reglas que limitan o excluyen.
    const reglas = container.querySelectorAll('.pd-score-info .beach-info-row');
    expect(reglas).toHaveLength(2);
    expect(reglas[0].querySelector('.beach-info-label')).toHaveTextContent('Lluvia');
  });

  it('cada factor enseña el dato de la playa que explica sus puntos', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    const valores = Array.from(container.querySelectorAll('.pd-factor-valor')).map(
      (n) => n.textContent,
    );

    expect(valores[0]).toBe('cielo despejado');   // cielo
    expect(valores[1]).toBe('22°');               // temperatura
    expect(valores[3]).toBe('Verde');             // bandera (viento va antes: pesa más)
    expect(valores[4]).toBe('marejadilla');       // oleaje
    expect(valores[5]).toBe('clima y bandera');   // datos
  });

  it('22° se lee como muy buena temperatura, no como un aprobado raspado', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    const puntos = container.querySelectorAll('.pd-factor-puntos');
    expect(puntos[1]).toHaveTextContent('22/25');
  });

  it('los puntos del desglose suman la nota cuando no hay tope', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    const suma = Array.from(container.querySelectorAll('.pd-factor-puntos'))
      .map((n) => Number((n.textContent ?? '').split('/')[0]))
      .reduce((a, b) => a + b, 0);

    expect(suma).toBe(93);
    expect(container.querySelector('.pd-score-tope')).toBeNull();
  });

  it('anuncia hacia dónde va el día sin desplegar nada, y sin repetirlo en la razón', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');

    const chip = container.querySelector('.trend-badge');
    expect(chip).toHaveTextContent('Está mejorando');
    expect(chip).toHaveTextContent('+6 puntos');
    // Y por qué mejora: "Mejora" a secas no dice si merece la pena esperar.
    expect(chip).toHaveTextContent('se despeja');
    // El backend ya lo dice en razonRanking; con el chip se diría dos veces.
    expect(container.querySelector('.pd-score-reason')).not.toHaveTextContent('próximas horas');
  });

  it('la tira horaria se ve sin desplegar nada y va justo encima de mareas', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');

    // Sin tocar "Cómo se calcula": vive en su propia sección de la página.
    const horas = container.querySelectorAll('.proximas-horas-section .pd-hora');
    expect(horas).toHaveLength(3);
    expect(horas[0].querySelector('.pd-hora-temp')).toHaveTextContent('21°');
    expect(horas[2].querySelector('.pd-hora-temp')).toHaveTextContent('23°');

    // El orden en el DOM: primero las próximas horas, después las mareas.
    const secciones = Array.from(
      container.querySelectorAll('.proximas-horas-section, .tides-section'),
    ).map((n) => n.className);
    expect(secciones).toEqual(['proximas-horas-section', 'tides-section']);
  });

  it('acredita quién pronostica esas horas, con lo que dice el API', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');

    // Acreditar y decir que van adaptados es UNA frase: la nota de la licencia
    // ya enlaza a Open-Meteo, así que no se repite el crédito genérico encima.
    fireEvent.click(abrirInfo('Fuente de las próximas horas'));

    const fuente = container.querySelector('.proximas-horas-fuente .info-datos-panel');
    expect(fuente).toHaveTextContent(
      'Datos meteorológicos de Open-Meteo, adaptados por Playucas.es: se transforman para calcular la puntuación.',
    );
    expect(fuente?.querySelector('a')).toHaveAttribute('href', 'https://open-meteo.com');
    expect(container.querySelectorAll('.proximas-horas-fuente')).toHaveLength(1);
  });

  it('el desplegable de la puntuación ya no repite la tira', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    expect(container.querySelectorAll('.pd-score-info .pd-hora')).toHaveLength(0);
  });

  it('sin desglose (backend antiguo) el panel sigue abriendo con sus reglas', async () => {
    // La Salvé no lleva el bloque aditivo en el fixture.
    const { container } = renderDetalle('3903501');
    await screen.findByText('Puntuación de hoy');
    fireEvent.click(screen.getByText('Cómo se calcula'));

    expect(container.querySelectorAll('.pd-factor')).toHaveLength(0);
    expect(container.querySelectorAll('.beach-info-row').length).toBeGreaterThan(0);
    expect(container.querySelector('.trend-badge')).toBeNull();
  });

  it('no muestra bloque de puntuación si la playa no está en el ranking', async () => {
    const detalle = buildAemetDetail(MEDIODIA);
    detalle.codigo = 'NO-EXISTE';
    mockDetalle(detalle);

    renderDetalle('NO-EXISTE');
    await screen.findByText('La Concha');

    expect(screen.queryByText('Puntuación de hoy')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — información de la playa', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(buildAemetDetail(MEDIODIA));
  });

  it('lista las filas de información con sus unidades', async () => {
    renderDetalle();
    await screen.findByText('Información de la playa');

    expect(screen.getByText('Dimensiones').nextElementSibling).toHaveTextContent('1000 m × 60 m');
    expect(screen.getByText('Tipo').nextElementSibling).toHaveTextContent('Urbana');
    expect(screen.getByText('Acceso').nextElementSibling).toHaveTextContent('A pie · En coche');
    expect(screen.getByText('Hospital').nextElementSibling).toHaveTextContent('a 10 km');
  });

  it('añade submarinismo a los atributos aunque venga como campo suelto', async () => {
    renderDetalle();
    await screen.findByText('Servicios y características');

    expect(screen.getByText('Submarinismo')).toBeInTheDocument();
    expect(screen.getByText('Duchas')).toBeInTheDocument();
    // `aseos: false` must not appear.
    expect(screen.queryByText('Aseos')).not.toBeInTheDocument();
  });

  it('enlaza la webcam en una pestaña nueva y de forma segura', async () => {
    renderDetalle();
    await screen.findByText('Webcam en directo');

    const link = screen.getByText('Abrir webcam').closest('a') as HTMLAnchorElement;
    expect(link).toHaveAttribute('href', 'https://example.test/webcam/la-concha');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('ofrece cómo llegar y ver en el mapa', async () => {
    renderDetalle();
    await screen.findByText('Cómo llegar');

    const dir = screen.getByText('Cómo llegar').closest('a') as HTMLAnchorElement;
    expect(dir.href).toContain(
      'https://www.google.com/maps/dir/?api=1&destination=43.43553526584305,-4.0427976710155225',
    );
    expect(screen.getByText('Ver en el mapa')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — estados', () => {
  it('muestra el spinner mientras carga', async () => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    const pending = deferred<RouteSpec>();
    mockDetalle(() => pending.promise);

    renderDetalle();

    expect(screen.getByText('Cargando datos de la playa...')).toBeInTheDocument();

    pending.resolve({ json: buildAemetDetail(MEDIODIA) });
    await screen.findByText('Hoy');
  });

  it('muestra el error si el detalle falla', async () => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(() => ({ status: 500 }));

    renderDetalle();

    await screen.findByText('No se pudo cargar el detalle de la playa');
    expect(screen.queryByText('Cargando datos de la playa...')).not.toBeInTheDocument();
  });

  it('dice la causa: el estado HTTP cuando el servidor contesta', async () => {
    // Tres veces hoy el mismo texto con tres causas distintas. La causa es lo
    // primero que hace falta, no un adorno.
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(() => ({ status: 429 }));

    const { container } = renderDetalle();

    await screen.findByText('No se pudo cargar el detalle de la playa');
    expect(container.querySelector('.error-causa')).toHaveTextContent('HTTP 429');
  });

  it('dice la causa: sin respuesta cuando la petición ni vuelve', async () => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(() => ({ networkError: true }));

    const { container } = renderDetalle();

    await screen.findByText('No se pudo cargar el detalle de la playa');
    expect(container.querySelector('.error-causa')).toHaveTextContent('Sin respuesta del servidor');
  });

  it('un fallo pasajero no deja el aviso clavado si el reintento trae los datos', async () => {
    // Lo de la captura: la ficha entera pintada (78/100, previsión, webcam...)
    // y encima el cartel rojo de "no se pudo cargar". El primer intento falló,
    // el segundo funcionó, y el error no se apagaba nunca.
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    let intento = 0;
    installFetchMock([
      route(FEATURED, { json: featuredResponse }),
      route(DETAILS, () => {
        intento += 1;
        return intento === 1 ? { networkError: true } : { json: buildAemetDetail(MEDIODIA) };
      }),
    ]);

    const { unmount } = renderDetalle();
    await screen.findByText('No se pudo cargar el detalle de la playa');

    // Segundo montaje (lo que hace StrictMode en desarrollo, o una renavegación).
    unmount();
    renderDetalle();

    await screen.findByText('Hoy');
    expect(screen.queryByText('No se pudo cargar el detalle de la playa')).not.toBeInTheDocument();
  });

  it('el aviso de error nunca convive con la ficha cargada', async () => {
    jest.useFakeTimers().setSystemTime(MEDIODIA);
    mockDetalle(buildAemetDetail(MEDIODIA));

    const { container } = renderDetalle();
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
describe('PlayaDetalle — tope publicado', () => {
  it('la nota del tope enseña el valor que publica el backend, no el 59 a fuego', async () => {
    // The forecast cap is graded now: rain 3 h away caps at 75, not 59.
    const conTope = {
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
    const despues = new Date(Date.now() + 10 * 60_000);
    jest.useFakeTimers().setSystemTime(despues);
    installFetchMock([
      route(FEATURED, { json: conTope }),
      route(DETAILS, { json: buildAemetDetail(despues) }),
    ]);

    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');
    // The score arrives from the (uncached) /featured after the detail does.
    await waitFor(() => expect(container.querySelector('.score-badge-num')).toHaveTextContent('75'));
    fireEvent.click(screen.getByText('Cómo se calcula'));

    expect(container.querySelector('.pd-score-tope')).toHaveTextContent(
      'Se espera lluvia: la nota se limita a 75',
    );
  });
});
