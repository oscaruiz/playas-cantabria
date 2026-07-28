/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Fija `PlayaDetalle` (ruta `/playas/:codigo`), que hoy son 1052 líneas con 16
 * componentes declarados dentro. Es la página que más se mueve en F4, así que
 * es donde más importa tener el comportamiento clavado.
 *
 * Sobre los relojes: la página mezcla dos.
 *  - Las pestañas de día y el estado de la marea usan la hora LOCAL del
 *    dispositivo, así que esos tests fijan el reloj con `localNoon()` (mediodía
 *    local), lo que los hace válidos en CI (UTC) y en Madrid por igual.
 *  - Las reglas de bandera usan `Europe/Madrid` vía `Intl`, así que sus tests
 *    fijan instantes UTC absolutos y no dependen de la TZ del runner.
 * Por eso los `describe` de bandera montan su propio reloj y no asertan sobre
 * las pestañas, y viceversa.
 *
 * `getDetallePlaya` no cachea, así que aquí sí se pueden usar payloads distintos
 * en cada test. La única caché en juego es la de `/featured`, y todos los tests
 * comparten el mismo fixture.
 */

import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
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

const FEATURED = '/api/beaches/featured';
const DETAILS = /\/api\/beaches\/[^/]+\/details$/;

const MEDIODIA = localNoon('2026-07-27'); // lunes

function mockDetalle(detalle: PlayaDetalle | (() => RouteSpec | Promise<RouteSpec>)) {
  installFetchMock([
    route(FEATURED, { json: featuredResponse }),
    route(DETAILS, typeof detalle === 'function' ? detalle : { json: detalle }),
  ]);
}

/**
 * Síncrono a propósito: cada test decide a qué esperar. Un helper `async` que
 * no se aguarda deja renders en vuelo que React acaba aplicando después del
 * teardown de jsdom.
 */
function renderDetalle(codigo = '3908503') {
  return renderWithProviders(<PlayaDetallePage />, {
    route: `/playas/${codigo}`,
    path: '/playas/:codigo',
  });
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

  it('para HOY prioriza la observación real sobre la previsión de la tarde', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    // tiempoActual.cielo = "cielo despejado"; dias[0].tarde.cielo = "intervalos nubosos".
    expect(container.querySelector('.forecast-hero-sky')).toHaveTextContent('Cielo despejado');
    expect(container.querySelector('.forecast-hero-icon-emoji')).toHaveTextContent('☀️');
  });

  it('muestra la temperatura observada y la máxima prevista', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.forecast-hero-temp')).toHaveTextContent('21°');
    // La línea "Máx." solo sale si la observada no supera a la máxima.
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
    // El prefijo "Índice ultravioleta" se recorta antes de mostrar el nivel.
    expect(uv).toHaveTextContent('10 — Muy alto');
    expect(uv).toHaveClass('uv-very-high');

    // aviso.nivel 3 → amarillo
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
    // El próximo evento es una pleamar → la marea sube.
    expect(container.querySelector('.tide-status')).toHaveTextContent('Subiendo');
    expect(container.querySelector('.tide-status')).toHaveClass('tide-status-rising');
  });

  it('limpia el asterisco de la fuente de mareas y el sufijo de la fuente meteo', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    expect(container.querySelector('.tides-source')).toHaveTextContent('Puerto de Santander');
    expect(container.querySelector('.tides-source')?.textContent).not.toContain('*');
    // AEMET_HTML se presenta como AEMET.
    expect(container.querySelector('.source-label')).toHaveTextContent(
      'Datos meteorológicos: AEMET',
    );
  });

  it('muestra la zona de avisos y la elaboración', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    const meta = container.querySelector('.forecast-metadata');
    expect(meta).toHaveTextContent('Zona de avisos: Litoral de Cantabria');
    expect(meta).toHaveTextContent('Elaborado el 27-07-2026 a las 10:00');
  });

  it('al cambiar de día usa la máxima prevista y muestra los dos medios días', async () => {
    const { container } = renderDetalle();
    await screen.findByText('Hoy');

    fireEvent.click(screen.getByText('Mañana', { selector: '.day-tab-title' }));

    // Sin observación real para un día futuro: manda temperaturaMaxima (28).
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
  /** Clona el fixture AEMET cambiando solo la señal de lluvia. */
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
    // Nunca dos badges: la previsión se calla mientras llueve.
    expect(container.querySelector('.forecast-hero-lluvia-prevista')).toBeNull();
    // Y el emoji pasa a lluvia aunque el cielo diga "despejado".
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

    // 16:00Z = 18:00 en Madrid.
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

    // uvIndex 6 → "Alto" según la escala OMS que aplica el frontend.
    const uv = container.querySelector('.uv-value');
    expect(uv).toHaveTextContent('6 — Alto');
    expect(uv).toHaveClass('uv-high');
  });

  it('etiqueta la fuente meteorológica declarada por `clima`', async () => {
    const { container } = renderDetalle('3905201');
    await screen.findByText('La Arnía');

    expect(container.querySelector('.source-label')).toHaveTextContent(
      'Datos meteorológicos: AEMET',
    );
  });
});

// ---------------------------------------------------------------------------

describe('PlayaDetalle — bandera de Cruz Roja', () => {
  it('dentro de horario y con captura fresca pinta el color pleno', async () => {
    // 12:00Z = 14:00 en Madrid, dentro de 11:00-20:00.
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

  it('fuera de horario enseña la última registrada, atenuada y fechada', async () => {
    // 05:00Z = 07:00 en Madrid, antes de abrir. Captura a las 19:30 de ayer.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-28T05:00:00.000Z'));
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
      'Registrada ayer a las 19:30',
    );
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
    await screen.findByText('Cruz Roja');

    expect(container.querySelector('.card-body')).not.toBeNull();
    expect(screen.getByText('Bandera actual').nextElementSibling).toHaveTextContent('Verde');
    expect(container.querySelector('.card-header')).toHaveAttribute('aria-expanded', 'true');
  });

  it('la tarjeta se pliega y despliega al pulsarla', async () => {
    const ahora = new Date('2026-07-27T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(ahora);
    mockDetalle(buildAemetDetail(ahora));

    const { container } = renderDetalle();
    await screen.findByText('Cruz Roja');

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

    expect(container.querySelector('.score-badge-num')).toHaveTextContent('82');
    expect(container.querySelector('.pd-score-reason')).toHaveTextContent(
      'cielo despejado, viento flojo, bandera verde',
    );
  });

  it('el desplegable "cómo se calcula" abre 8 factores', async () => {
    const { container } = renderDetalle('3908503');
    await screen.findByText('Puntuación de hoy');

    expect(container.querySelector('.pd-score-info')).toBeNull();

    fireEvent.click(screen.getByText('Cómo se calcula'));

    const filas = container.querySelectorAll('.pd-score-info .beach-info-row');
    expect(filas).toHaveLength(8);
    expect(filas[0].querySelector('.beach-info-label')).toHaveTextContent('Sol y cielo');
    expect(filas[0].querySelector('.beach-info-value')).toHaveTextContent(
      'cuanto más despejado, mejor.',
    );
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
    // `aseos: false` no debe aparecer.
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
});
