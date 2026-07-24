import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { chevronBackOutline, navigateOutline, mapOutline, videocamOutline, warningOutline, chevronDownOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import {
  getDetallePlaya,
  getFeaturedBeaches,
  FeaturedBeach,
  PlayaDetalle as PlayaDetalleData,
  DiaPrediccionDTO,
  HalfDayDTO,
  PrediccionDia,
} from '../services/api';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import './PlayaDetalle.css';
import {
  flagColorClass,
  estadoBandera,
  capitalizar,
  emojiCielo,
  esLluviaActiva,
  lluviaPrevista,
  horaLocalMadrid,
  getActiveAttrs,
  formatearHaceTiempo,
  claveCoberturaWebcam,
} from '../utils/beachHelpers';
import { useIdioma, Idioma, TraducirFn } from '../i18n/IdiomaContext';
import { ClaveTexto } from '../i18n/es';
import { traducirTextoApi, razonLegible, claveEstadoBandera } from '../i18n/apiText';
import ScoreBadge from '../components/ScoreBadge';
import { nombreDia, traducirNombreDiaApi, formatearFechaCorta } from '../i18n/fechas';

// ---- Helpers ----

function cruzRojaField(value: string | undefined, t: TraducirFn): string {
  if (!value || value.trim() === '' || value === 'N/A') return t('comun.noDisponible');
  return value;
}

/**
 * Extract day-of-month from fecha string.
 * Handles both "domingo 05" (AEMET HTML scraper) and "2026-04-06" (ISO) formats.
 */
function parseDayOfMonth(fecha: string): number {
  if (!fecha) return -1;
  // ISO format: "2026-04-06"
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return new Date(fecha + 'T12:00:00').getDate();
  }
  // AEMET format: "domingo 05"
  const match = fecha.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : -1;
}

function dayTitle(fecha: string, t: TraducirFn, idioma: Idioma): string {
  const dayNum = parseDayOfMonth(fecha);
  if (dayNum < 0) return fecha || '?';

  const now = new Date();
  const hoy = now.getDate();
  const manana = new Date(now);
  manana.setDate(hoy + 1);
  const pasado = new Date(now);
  pasado.setDate(hoy + 2);

  if (dayNum === hoy) return t('fecha.hoy');
  if (dayNum === manana.getDate()) return t('fecha.manana');
  if (dayNum === pasado.getDate()) return t('fecha.pasadoManana');

  // Fecha fuera del rango — extraer nombre del día del string (español, del API)
  const nombreDiaApi = fecha.split(/\s/)[0];
  const traducido = traducirNombreDiaApi(nombreDiaApi, idioma);
  return capitalizar(traducido ?? nombreDiaApi) || fecha;
}

function daySubtitle(fecha: string, idioma: Idioma): string {
  const dayNum = parseDayOfMonth(fecha);
  if (dayNum < 0) return '';

  // Formato AEMET tipo "domingo 05" — nombre del string + día + mes actual
  const nombreDiaApi = fecha.split(/\s/)[0];
  if (nombreDiaApi && /^[a-z\u00e1-\u00fa]/i.test(nombreDiaApi)) {
    const now = new Date();
    const traducido = traducirNombreDiaApi(nombreDiaApi, idioma) ?? nombreDiaApi;
    return formatearFechaCorta(capitalizar(traducido), dayNum, now.getMonth(), idioma);
  }

  // ISO fallback
  const d = new Date(fecha + 'T12:00:00');
  return formatearFechaCorta(capitalizar(nombreDia(d.getDay(), idioma)), d.getDate(), d.getMonth(), idioma);
}

function isToday(fecha: string): boolean {
  return parseDayOfMonth(fecha) === new Date().getDate();
}

function hasHalfDayData(h: HalfDayDTO): boolean {
  return h.cielo != null || h.viento != null || h.oleaje != null;
}

// ---- Sub-components ----

const FlagBanner: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  const { t } = useIdioma();
  const estado = estadoBandera(cruzRoja);
  // 'sinDatos' (dentro de horario aún sin captura, transitorio): no mostramos banner.
  if (estado === 'sinDatos') {
    return null;
  }

  // Solo se pinta el color si la bandera es vigente ('color'); fuera de horario o
  // con dato no fresco se muestra el banderín neutro, aunque haya color guardado.
  const colorClass = estado === 'color' ? flagColorClass(cruzRoja!.bandera) : 'unknown';
  const actualizado =
    estado === 'color' && cruzRoja!.ultimaActualizacion
      ? formatearHaceTiempo(cruzRoja!.ultimaActualizacion, t)
      : '';

  return (
    <div className="flag-banner">
      <span className={`flag-pennant ${colorClass}`} role="img" aria-label={t('detalle.banderaAria')} />
      <div className="flag-info">
        <div className="flag-label">{t('detalle.estadoBano')}</div>
        <div className="flag-value">{t(claveEstadoBandera(estado, cruzRoja!.bandera))}</div>
        {cruzRoja!.horario && (
          <div className="flag-horario">{t('detalle.vigilancia', { horario: cruzRoja!.horario })}</div>
        )}
        {actualizado && <div className="flag-horario">{capitalizar(actualizado)}</div>}
      </div>
    </div>
  );
};

// ---- Helpers (aviso / UV) ----

function avisoLevelClass(nivel: number | null): string {
  if (nivel === 1) return 'aviso-red';
  if (nivel === 2) return 'aviso-orange';
  if (nivel === 3) return 'aviso-yellow';
  return 'aviso-green';
}

function uvColorClass(uv: number): string {
  if (uv <= 2) return 'uv-low';
  if (uv <= 5) return 'uv-moderate';
  if (uv <= 7) return 'uv-high';
  return 'uv-very-high';
}

// ---- Day Selector (tabs editoriales con subrayado) ----

const DaySelector: React.FC<{
  fechas: string[];
  selectedDay: number;
  onSelect: (i: number) => void;
}> = ({ fechas, selectedDay, onSelect }) => {
  const { t, idioma } = useIdioma();
  return (
    <div className="day-selector" role="tablist">
      {fechas.map((fecha, i) => (
        <button
          key={fecha}
          className={`day-tab${i === selectedDay ? ' active' : ''}`}
          onClick={() => onSelect(i)}
          role="tab"
          aria-selected={i === selectedDay}
        >
          <span className="day-tab-title">{dayTitle(fecha, t, idioma)}</span>
          <span className="day-tab-date">{daySubtitle(fecha, idioma)}</span>
        </button>
      ))}
    </div>
  );
};

// ---- Forecast Hero (big icon + temp + badges) ----

/** Map wind description text to a speed level 0–4 for animation. */
function windSpeedLevel(text: string): number {
  const t = text.toLowerCase();
  if (/calma|en calma/.test(t)) return 0;
  if (/flojo|d[eé]bil|ligero|suave/.test(t)) return 1;
  if (/moderado|variable/.test(t)) return 2;
  if (/fresco/.test(t)) return 3;
  if (/fuerte|muy fuerte|intenso/.test(t)) return 4;
  return 1; // default: light animation
}

/**
 * Duración (segundos) de la animación por nivel de viento. Nivel 0 (calma) no
 * se para del todo: gira muy lento para que el molino se vea "vivo" y no roto.
 */
const WIND_DURATIONS = [7, 4, 2, 1, 0.5];

const WindTurbine: React.FC<{ level: number; label: string }> = ({ level, label }) => {
  const { t } = useIdioma();
  const duration = WIND_DURATIONS[level] ?? 2;
  const paused = false;

  return (
    <div className="wind-turbine-wrap">
      <div className="wind-turbine-icon">
        <svg viewBox="0 0 40 44" className="wind-turbine-svg">
          {/* Pole */}
          <line x1="20" y1="18" x2="20" y2="43" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          {/* Hub */}
          <circle cx="20" cy="18" r="2" fill="currentColor" />
          {/* Blades */}
          <g
            className="wind-turbine-blades"
            style={{
              transformOrigin: '20px 18px',
              animationDuration: `${duration}s`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            <path d="M20,18 L18.5,3 Q20,1 21.5,3 Z" fill="currentColor" opacity="0.85" />
            <path d="M20,18 L31,25.5 Q31.5,23 29.5,22 Z" fill="currentColor" opacity="0.85" />
            <path d="M20,18 L9,25.5 Q8.5,23 10.5,22 Z" fill="currentColor" opacity="0.85" />
          </g>
        </svg>
      </div>
      <span className="forecast-indicator-title">{t('detalle.viento')}</span>
      <span className="forecast-indicator-label">{label}</span>
    </div>
  );
};

const WavesIndicator: React.FC<{ label: string }> = ({ label }) => {
  const { t } = useIdioma();
  return (
  <div className="waves-indicator-wrap">
    <div className="waves-indicator-icon">
      <svg viewBox="0 0 40 28" className="waves-indicator-svg">
        <g className="waves-anim">
          <path d="M-10,14 Q-5,8 0,14 Q5,20 10,14 Q15,8 20,14 Q25,20 30,14 Q35,8 40,14 Q45,20 50,14"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M-10,22 Q-5,16 0,22 Q5,28 10,22 Q15,16 20,22 Q25,28 30,22 Q35,16 40,22 Q45,28 50,22"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </g>
      </svg>
    </div>
    <span className="forecast-indicator-title">{t('detalle.oleaje')}</span>
    <span className="forecast-indicator-label">{label}</span>
  </div>
  );
};

const ForecastHero: React.FC<{
  dia: DiaPrediccionDTO;
  climaActual?: number | null;
  tiempoActual?: PlayaDetalleData['tiempoActual'];
}> = ({ dia, climaActual, tiempoActual }) => {
  const { t, idioma } = useIdioma();
  // skyText/viento/oleaje son el español crudo del API: emojiCielo y
  // windSpeedLevel hacen regex sobre él — traducir solo al mostrar.
  // Para HOY priorizamos la observación real ("ahora") sobre la previsión de
  // la tarde; así el titular deja de contradecir al desglose mañana/tarde.
  const skyText = capitalizar(tiempoActual?.cielo ?? dia.tarde.cielo ?? dia.manana.cielo ?? '');
  const viento = capitalizar(dia.tarde.viento ?? dia.manana.viento ?? '');
  const oleaje = capitalizar(dia.tarde.oleaje ?? dia.manana.oleaje ?? '');
  const skyEmoji = emojiCielo(skyText || null);

  const tempPrincipal = climaActual ?? dia.temperaturaMaxima;
  const showMax = climaActual != null && dia.temperaturaMaxima != null && climaActual <= dia.temperaturaMaxima;
  const wLevel = viento ? windSpeedLevel(viento) : 1;

  // Lluvia detectada AHORA (señal multi-fuente del backend). `tiempoActual`
  // solo llega cuando el día seleccionado es HOY, así que el badge no se
  // muestra en días futuros.
  const lloviendo = esLluviaActiva(tiempoActual);
  const mmLluvia = tiempoActual?.lluvia?.mm ?? tiempoActual?.precipitacionMm ?? null;
  // Lluvia PREVISTA (próximas horas). Null si ya llueve: nunca dos badges.
  const prevista = lluviaPrevista(tiempoActual);
  const horaPrevista = horaLocalMadrid(prevista?.desdeIso);

  return (
    <div className="forecast-hero">
      <div className="forecast-hero-main">
        <div className="forecast-hero-col">
          <span className="forecast-hero-icon-emoji">{lloviendo ? '\u{1F327}\uFE0F' : skyEmoji}</span>
          {tempPrincipal != null && (
            <span className="forecast-hero-temp">{Math.round(tempPrincipal)}&deg;</span>
          )}
          {showMax && (
            <span className="forecast-hero-max">{t('detalle.max')} {dia.temperaturaMaxima}&deg;</span>
          )}
          {lloviendo && (
            <span className="forecast-hero-lluvia" role="status">
              {tiempoActual?.lluvia?.ultimaHora ? t('detalle.lluviaUltimaHora') : t('detalle.lloviendoAhora')}
              {mmLluvia != null && mmLluvia > 0 && ` · ${mmLluvia.toFixed(1)} mm`}
            </span>
          )}
          {prevista && (
            <span className="forecast-hero-lluvia forecast-hero-lluvia-prevista" role="status">
              {horaPrevista
                ? t('detalle.lluviaPrevistaHora', { hora: horaPrevista })
                : t('detalle.lluviaPrevistaHoy')}
            </span>
          )}
          {skyText && <span className="forecast-hero-sky">{traducirTextoApi(skyText, idioma)}</span>}
          {dia.temperaturaAgua != null && (
            <span className="forecast-hero-agua">{t('detalle.aguaGrados', { temp: dia.temperaturaAgua })}</span>
          )}
        </div>
        {viento && <WindTurbine level={wLevel} label={traducirTextoApi(viento, idioma)} />}
        {oleaje && <WavesIndicator label={traducirTextoApi(oleaje, idioma)} />}
      </div>
    </div>
  );
};

// ---- Clima Hero (playas sin ficha AEMET: mismo estilo, datos de `clima`) ----

/**
 * Nivel UV (etiqueta traducible) derivado del índice, escala OMS. OpenWeather
 * solo da el número, así que sintetizamos la etiqueta para que `DailyStats`
 * muestre "10 — Muy alto" como en las playas con ficha AEMET. Claves alineadas
 * con `MAPA_UV` de `i18n/apiText.ts`.
 */
function nivelUVDesdeIndice(uv: number): string {
  if (uv <= 2) return 'Bajo';
  if (uv <= 5) return 'Medio';
  if (uv <= 7) return 'Alto';
  if (uv <= 10) return 'Muy alto';
  return 'Extremo';
}

/**
 * Adapta un día de `clima` (OpenWeather) al shape que consume `ForecastHero`.
 * Solo interesa el titular (cielo/temp/agua/viento/oleaje); no hay desglose
 * mañana/tarde ni avisos, así que ambos medios días llevan el mismo resumen.
 * `esHoy`: sin máxima diaria en OpenWeather, la temp principal de hoy es la
 * observación real (`temperaturaActual`), así que dejamos `temperaturaMaxima`
 * a null para no pintar una línea "Máx" duplicada.
 */
function climaDiaAPrediccion(d: PrediccionDia, fecha: string, esHoy: boolean): DiaPrediccionDTO {
  const medio: HalfDayDTO = { cielo: d.summary, iconoCielo: null, viento: d.wind, oleaje: d.waves };
  return {
    fecha,
    manana: medio,
    tarde: medio,
    temperaturaMaxima: esHoy ? null : d.temperature,
    sensacionTermica: d.sensation,
    temperaturaAgua: d.waterTemperature,
    indiceUV: d.uvIndex ?? null,
    nivelUV: d.uvIndex != null ? nivelUVDesdeIndice(d.uvIndex) : null,
    aviso: null,
  };
}

/**
 * Cabecera meteorológica para playas SIN ficha AEMET (`prediccionCompleta`
 * nula, p. ej. código sintético). Reutiliza el hero con selector Hoy/Mañana a
 * partir de `clima`, omitiendo el desglose "Previsión AEMET" y las mareas, que
 * esta fuente no aporta.
 */
const ClimaHero: React.FC<{
  clima: NonNullable<PlayaDetalleData['clima']>;
  temperaturaActual?: number | null;
  tiempoActual?: PlayaDetalleData['tiempoActual'];
}> = ({ clima, temperaturaActual, tiempoActual }) => {
  const [diaSel, setDiaSel] = useState(0);

  const hoy = new Date();
  const isoConOffset = (dias: number): string => {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const dias = [
    { clima: clima.hoy, fecha: isoConOffset(0), esHoy: true },
    ...(clima.manana ? [{ clima: clima.manana, fecha: isoConOffset(1), esHoy: false }] : []),
  ];
  const sel = Math.min(diaSel, dias.length - 1);
  const actual = dias[sel];
  const dia = climaDiaAPrediccion(actual.clima, actual.fecha, actual.esHoy);

  return (
    <>
      {dias.length > 1 && (
        <DaySelector fechas={dias.map((d) => d.fecha)} selectedDay={sel} onSelect={setDiaSel} />
      )}
      <div className="detail-card prevision-panel">
        <ForecastHero
          dia={dia}
          climaActual={actual.esHoy ? temperaturaActual : undefined}
          tiempoActual={actual.esHoy ? tiempoActual : undefined}
        />
        <DailyStats dia={dia} embedded />
      </div>
    </>
  );
};

// ---- Half-day detail (morning / afternoon side by side) ----

const HalfDayDetail: React.FC<{
  manana: HalfDayDTO;
  tarde: HalfDayDTO;
}> = ({ manana, tarde }) => {
  const { t, idioma } = useIdioma();
  const hasMorning = hasHalfDayData(manana);

  const renderBlock = (data: HalfDayDTO, period: 'morning' | 'afternoon') => {
    const label = period === 'morning' ? t('detalle.periodoManana') : t('detalle.periodoTarde');
    return (
      <div className={`halfday-block ${period}`}>
        <div className="halfday-block-label">{label}</div>
        <div className="halfday-block-rows">
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon" aria-hidden="true">{emojiCielo(data.cielo)}</span>
            <span>{traducirTextoApi(capitalizar(data.cielo), idioma) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-row-label">{t('detalle.viento')}</span>
            <span>{traducirTextoApi(capitalizar(data.viento), idioma) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-row-label">{t('detalle.oleaje')}</span>
            <span>{traducirTextoApi(capitalizar(data.oleaje), idioma) || '--'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`halfday-detail${hasMorning ? '' : ' single'}`}>
      {hasMorning && renderBlock(manana, 'morning')}
      {renderBlock(tarde, 'afternoon')}
    </div>
  );
};

// ---- Daily Stats (sensation, UV badge, warning) ----

const DailyStats: React.FC<{ dia: DiaPrediccionDTO; embedded?: boolean }> = ({ dia, embedded }) => {
  const { t, idioma } = useIdioma();
  const hasAny = dia.sensacionTermica || dia.indiceUV != null || (dia.aviso && dia.aviso.descripcion);
  if (!hasAny) return null;

  // `embedded`: se renderiza dentro de la tarjeta "Previsión meteorológica AEMET",
  // por lo que omite su propio envoltorio `.detail-card` (evita card dentro de card).
  const body = (
    <div className={`daily-stats-body${embedded ? ' daily-stats-embedded' : ''}`}>
        {dia.sensacionTermica && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.sensacionTermica')}</span>
            <span className="daily-stat-value">{traducirTextoApi(capitalizar(dia.sensacionTermica), idioma)}</span>
          </div>
        )}
        {dia.indiceUV != null && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.indiceUV')}</span>
            <span className={`daily-stat-value uv-value ${uvColorClass(dia.indiceUV)}`}>
              <span className="uv-swatch" aria-hidden="true" />
              {dia.indiceUV}
              {dia.nivelUV && ` \u2014 ${traducirTextoApi(dia.nivelUV.replace(/^índice ultravioleta\s*/i, ''), idioma)}`}
            </span>
          </div>
        )}
        {dia.aviso && dia.aviso.descripcion && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.avisoLitoral')}</span>
            <span className={`daily-stat-value ${avisoLevelClass(dia.aviso.nivel)}`}>
              {traducirTextoApi(capitalizar(dia.aviso.descripcion), idioma)}
            </span>
          </div>
        )}
      </div>
  );

  if (embedded) return body;
  return <div className="daily-stats-card">{body}</div>;
};

// ---- Tides Section (selected day only, sorted by time) ----

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getTideStatus(
  entries: Array<{ time: string; type: 'pleamar' | 'bajamar'; minutes: number }>,
  isToday: boolean,
): { clave: ClaveTexto; className: string } | null {
  if (!isToday || entries.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Buscar entre qué dos eventos estamos
  for (let i = 0; i < entries.length; i++) {
    if (nowMinutes < entries[i].minutes) {
      // Estamos antes de este evento → la marea se dirige hacia él
      const next = entries[i];
      if (next.type === 'pleamar') {
        return { clave: 'marea.subiendo', className: 'tide-status-rising' };
      } else {
        return { clave: 'marea.bajando', className: 'tide-status-falling' };
      }
    }
  }

  // Después del último evento del día: si el último fue pleamar → bajando, y viceversa
  const last = entries[entries.length - 1];
  if (last.type === 'pleamar') {
    return { clave: 'marea.bajando', className: 'tide-status-falling' };
  }
  return { clave: 'marea.subiendo', className: 'tide-status-rising' };
}

const TidesSection: React.FC<{
  marea: { pleamar: string[]; bajamar: string[] };
  fuenteMareas: string | null;
  isToday: boolean;
}> = ({ marea, fuenteMareas, isToday }) => {
  const { t } = useIdioma();
  if (marea.pleamar.length === 0 && marea.bajamar.length === 0) return null;

  // Combinar y ordenar por hora
  const entries = [
    ...marea.pleamar.map((t) => ({ time: t, type: 'pleamar' as const, minutes: parseTimeMinutes(t) })),
    ...marea.bajamar.map((t) => ({ time: t, type: 'bajamar' as const, minutes: parseTimeMinutes(t) })),
  ].sort((a, b) => a.minutes - b.minutes);

  const status = getTideStatus(entries, isToday);

  return (
    <section className="tides-section">
      <h3 className="section-kicker">{t('detalle.mareas')}</h3>
      {status && (
        <div className={`tide-status ${status.className}`}>
          {status.className === 'tide-status-rising' ? '\u2197' : '\u2198'} {t(status.clave)}
        </div>
      )}
      <div className="tides-list">
        {entries.map((entry, i) => (
          <div className={`tide-entry ${entry.type}`} key={i}>
            <span className={`tide-arrow ${entry.type === 'pleamar' ? 'up' : 'down'}`} aria-hidden="true">
              {entry.type === 'pleamar' ? '\u2191' : '\u2193'}
            </span>
            <span className="tide-label">{entry.type === 'pleamar' ? t('marea.pleamar') : t('marea.bajamar')}</span>
            <span className="tide-time-value">{entry.time}</span>
          </div>
        ))}
      </div>
      {fuenteMareas && (
        <div className="tides-source">{fuenteMareas.replace(/^\*/, '')}</div>
      )}
    </section>
  );
};

// ---- Metadata Footer ----

const MetadataFooter: React.FC<{
  zonaAvisos: string | null;
  elaboracion: string | null;
}> = ({ zonaAvisos, elaboracion }) => {
  const { t } = useIdioma();
  if (!zonaAvisos && !elaboracion) return null;
  return (
    <div className="forecast-metadata">
      {zonaAvisos && <span>{t('detalle.zonaAvisos', { zona: zonaAvisos })}</span>}
      {zonaAvisos && elaboracion && <span> &middot; </span>}
      {elaboracion && <span>{elaboracion}</span>}
    </div>
  );
};

// ---- Beach Info Section (enriched data) ----

const BeachInfoSection: React.FC<{ datos: PlayaDetalleData }> = ({ datos }) => {
  const { t, idioma } = useIdioma();
  const hasAny = datos.longitud || datos.anchura || datos.tipoPlaya || datos.arena
    || (datos.acceso && datos.acceso.length > 0) || datos.parkingDescripcion || datos.bus || datos.hospitalDistancia != null;
  if (!hasAny) return null;

  return (
    <section className="detail-section beach-info-section">
      <h3 className="section-kicker">{t('detalle.infoPlaya')}</h3>
      <div className="beach-info-grid">
        {(datos.longitud || datos.anchura) && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.dimensiones')}</span>
            <span className="beach-info-value">
              {datos.longitud ? `${datos.longitud} m` : '\u2014'}
              {' \u00D7 '}
              {datos.anchura ? `${datos.anchura} m` : '\u2014'}
            </span>
          </div>
        )}
        {datos.tipoPlaya && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.tipo')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.tipoPlaya, idioma)}</span>
          </div>
        )}
        {datos.arena && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.arena')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.arena, idioma)}</span>
          </div>
        )}
        {datos.acceso && datos.acceso.length > 0 && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.acceso')}</span>
            <span className="beach-info-value">
              {datos.acceso.map((a) => traducirTextoApi(a, idioma)).join(' \u00B7 ')}
            </span>
          </div>
        )}
        {datos.parkingDescripcion && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.parking')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.parkingDescripcion, idioma)}</span>
          </div>
        )}
        {datos.bus && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.bus')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.bus, idioma)}</span>
          </div>
        )}
        {datos.hospitalDistancia != null && (
          <div className="beach-info-row">
            <span className="beach-info-label">{t('detalle.hospital')}</span>
            <span className="beach-info-value">{t('comun.aKm', { km: datos.hospitalDistancia })}</span>
          </div>
        )}
      </div>
    </section>
  );
};

// ---- Beach Attributes Section ----

const BeachAttributesSection: React.FC<{ atributos: PlayaDetalleData['atributos'] }> = ({ atributos }) => {
  const { t } = useIdioma();
  const attrs = getActiveAttrs(atributos);
  if (attrs.length === 0) return null;

  return (
    <section className="detail-section attr-section">
      <h3 className="section-kicker">{t('detalle.servicios')}</h3>
      <div className="attr-grid">
        {attrs.map((a) => {
          const label = t(`attr.${a.key}` as ClaveTexto);
          return (
            <span key={a.key} className="attr-item">
              <IonIcon icon={a.icon} aria-hidden="true" /> {label}
            </span>
          );
        })}
      </div>
    </section>
  );
};

// ---- Cruz Roja Card ----

const CruzRojaCard: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  const { t, idioma } = useIdioma();
  const estado = estadoBandera(cruzRoja);
  const hasData = estado === 'color';
  // Tambi\u00E9n se puede desplegar fuera de horario para ver cobertura/horario.
  const expandable = estado !== 'sinDatos';
  const [expanded, setExpanded] = useState(hasData);

  return (
    <div className="detail-disclosure">
      <div
        className={`card-header${!expandable ? ' card-header-disabled' : ''}`}
        onClick={expandable ? () => setExpanded((v) => !v) : undefined}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? expanded : undefined}
        aria-controls={expandable ? 'cruzroja-content' : undefined}
        aria-label={expandable ? `${expanded ? t('detalle.contraer') : t('detalle.expandir')} ${t('comun.cruzRoja')}` : undefined}
        aria-disabled={!expandable ? true : undefined}
        onKeyDown={expandable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        } : undefined}
      >
        <div>
          <div className="card-header-title">{t('comun.cruzRoja')}</div>
          <div className="card-header-subtitle">
            {hasData
              ? t('cruzroja.vigilanciaCobertura')
              : estado === 'fueraDeHorario'
                ? t('bandera.fueraDeHorario')
                : t('cruzroja.sinInfo')}
          </div>
        </div>
        {expandable && <span className={`card-header-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">&#9662;</span>}
      </div>

      {expanded && (
        <div className="card-body card-body-enter" id="cruzroja-content">
          <div className="info-rows">
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.banderaActual')}</span>
              <span className={`info-row-value ${!hasData ? 'muted' : ''}`}>
                {hasData
                  ? traducirTextoApi(cruzRoja!.bandera, idioma)
                  : estado === 'fueraDeHorario'
                    ? t('bandera.fueraDeHorario')
                    : t('comun.noDisponible')}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.coberturaDesde')}</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaDesde ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaDesde, t)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.coberturaHasta')}</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaHasta ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaHasta, t)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-row-label">{t('cruzroja.horario')}</span>
              <span className={`info-row-value ${!cruzRoja?.horario ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.horario, t)}
              </span>
            </div>
          </div>
          {cruzRoja?.ultimaActualizacion && (
            <p className="cruzroja-actualizado">
              {capitalizar(formatearHaceTiempo(cruzRoja.ultimaActualizacion, t))}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Webcam Card ----

/**
 * Webcam de la playa como ENLACE externo (nunca embebido). El título muestra la
 * cobertura (exacta / panorámica compartida / cercana) para no inducir a error.
 * Se oculta por completo si no hay webcam o está desactivada.
 */
export const WebcamCard: React.FC<{ webcam?: PlayaDetalleData['webcam'] }> = ({ webcam }) => {
  const { t } = useIdioma();
  if (!webcam || webcam.estado === 'desactivada') return null;

  return (
    <section className="detail-section webcam-section">
      <h3 className="section-kicker">{t(claveCoberturaWebcam(webcam.cobertura))}</h3>
      <a
        className="webcam-open-link"
        href={webcam.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <IonIcon icon={videocamOutline} aria-hidden="true" /> {t('webcam.abrir')}
      </a>
    </section>
  );
};

// ---- Main Page ----

// Factores del cálculo de la puntuación (grosso modo, sin detalles técnicos),
// ordenados por el peso aproximado que tienen en la nota. Cada texto es
// "Concepto: descripción" y se pinta como fila etiqueta/valor (patrón de la
// sección "Información de la playa").
const SCORE_ROWS: ClaveTexto[] = [
  'detalle.scoreInfo.sol',
  'detalle.scoreInfo.temp',
  'detalle.scoreInfo.bandera',
  'detalle.scoreInfo.viento',
  'detalle.scoreInfo.oleaje',
  'detalle.scoreInfo.uv',
  'detalle.scoreInfo.lluvia',
  'detalle.scoreInfo.peligro',
];

const PlayaDetallePage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const history = useHistory();
  const { t, idioma } = useIdioma();
  const [datos, setDatos] = useState<PlayaDetalleData | null>(null);
  const [error, setError] = useState(false);
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  // Puntuación del ranking (endpoint featured). Se pide EN PARALELO y es opcional:
  // el detalle se pinta sin esperarla, y si falla/tarda simplemente no se muestra.
  const [puntuada, setPuntuada] = useState<FeaturedBeach | null>(null);

  useEffect(() => {
    getDetallePlaya(codigo)
      .then(setDatos)
      .catch(() => setError(true));
  }, [codigo]);

  useEffect(() => {
    let activo = true;
    getFeaturedBeaches()
      .then((res) => {
        if (activo) setPuntuada(res.resumenTodas.find((b) => b.codigo === codigo) ?? null);
      })
      .catch(() => { /* no bloqueante: sin puntuación */ });
    return () => { activo = false; };
  }, [codigo]);

  const [selectedDay, setSelectedDay] = useState(0);
  const pred = datos?.prediccionCompleta;
  const fuente = pred?.fuente ?? datos?.clima?.fuente ?? '';
  const safeDayIndex = pred ? Math.min(selectedDay, pred.dias.length - 1) : 0;

  return (
    <IonPage className="playa-detalle-page">
      <div className="pd-sticky-header">
        <button className="pd-back-btn" onClick={() => history.goBack()} aria-label={t('detalle.volver')}>
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
        <div>
          <h1 className="pd-sticky-title">{datos?.nombre || t('detalle.titulo')}</h1>
          <p className="pd-sticky-subtitle">{datos?.municipio || ''}</p>
        </div>
        <SelectorIdioma />
      </div>

      <IonContent>
        {error && (
          <div className="error-container">
            <p style={{ margin: 0 }}>{t('detalle.errorCarga')}</p>
          </div>
        )}

        {!datos && !error && (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <span className="loading-text">{t('detalle.cargando')}</span>
          </div>
        )}

        {datos && (
          <>
            {/* HERO SECTION */}
            <div className="hero-section">
              {datos.lat != null && datos.lon != null && (
                <div className="hero-links">
                  <a
                    className="hero-directions-link"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${datos.lat},${datos.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IonIcon icon={navigateOutline} aria-hidden="true" /> {t('detalle.comoLlegar')}
                  </a>
                  <button
                    className="hero-directions-link"
                    onClick={() => history.push(`/mapa?lat=${datos.lat}&lon=${datos.lon}&codigo=${datos.codigo}`)}
                  >
                    <IonIcon icon={mapOutline} aria-hidden="true" /> {t('detalle.verEnMapa')}
                  </button>
                </div>
              )}

              <FlagBanner cruzRoja={datos.cruzRoja} />

              {puntuada && (
                <div className="pd-score-block">
                  <button
                    type="button"
                    className="pd-score-card pd-score-card--btn"
                    onClick={() => setScoreInfoOpen((o) => !o)}
                    aria-expanded={scoreInfoOpen}
                    aria-controls="pd-score-info"
                  >
                    <ScoreBadge puntuacion={puntuada.puntuacion} size="lg" />
                    <div className="pd-score-text">
                      <p className="pd-score-label">
                        <span>{t('detalle.puntuacion')}</span>
                        <span className="pd-score-help">
                          {t('detalle.comoSeCalcula')}
                          <IonIcon
                            icon={chevronDownOutline}
                            className={`pd-score-chevron${scoreInfoOpen ? ' open' : ''}`}
                            aria-hidden="true"
                          />
                        </span>
                      </p>
                      {puntuada.razonRanking && (
                        <p className="pd-score-reason">
                          {traducirTextoApi(razonLegible(puntuada.razonRanking), idioma)}
                        </p>
                      )}
                      {puntuada.motivoBaja && (
                        <p className="pd-score-caveat">
                          <IonIcon icon={warningOutline} aria-hidden="true" />{' '}
                          {traducirTextoApi(puntuada.motivoBaja, idioma)}
                        </p>
                      )}
                    </div>
                  </button>

                  {scoreInfoOpen && (
                    <div id="pd-score-info" className="pd-score-info">
                      <p className="pd-score-info-intro">{t('detalle.scoreInfo.intro')}</p>
                      <div className="beach-info-grid">
                        {SCORE_ROWS.map((k) => {
                          const texto = t(k);
                          const sep = texto.indexOf(':');
                          const etiqueta = sep >= 0 ? texto.slice(0, sep) : texto;
                          const valor = sep >= 0 ? texto.slice(sep + 1).trim() : '';
                          return (
                            <div className="beach-info-row" key={k}>
                              <span className="beach-info-label">{etiqueta}</span>
                              <span className="beach-info-value">{valor}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="pd-score-info-cierre">{t('detalle.scoreInfo.cierre')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DETAIL CONTENT */}
            <div className="detail-content">
              <div className="detail-col detail-col--forecast">
              {pred && pred.dias.length > 0 ? (
                <>
                  <DaySelector
                    fechas={pred.dias.map((d) => d.fecha)}
                    selectedDay={safeDayIndex}
                    onSelect={setSelectedDay}
                  />
                  <div className="detail-card prevision-panel">
                    <ForecastHero
                      dia={pred.dias[safeDayIndex]}
                      climaActual={isToday(pred.dias[safeDayIndex].fecha) ? datos.temperaturaActual : undefined}
                      tiempoActual={isToday(pred.dias[safeDayIndex].fecha) ? datos.tiempoActual : undefined}
                    />
                    <h3 className="section-kicker">{t('detalle.previsionAemet')}</h3>
                    <HalfDayDetail
                      manana={pred.dias[safeDayIndex].manana}
                      tarde={pred.dias[safeDayIndex].tarde}
                    />
                    <DailyStats dia={pred.dias[safeDayIndex]} embedded />
                  </div>
                  {pred.mareas?.[safeDayIndex] && (
                    <TidesSection
                      marea={pred.mareas[safeDayIndex]}
                      fuenteMareas={pred.fuenteMareas}
                      isToday={safeDayIndex === 0}
                    />
                  )}
                </>
              ) : datos.clima ? (
                <ClimaHero
                  clima={datos.clima}
                  temperaturaActual={datos.temperaturaActual}
                  tiempoActual={datos.tiempoActual}
                />
              ) : null}
              </div>

              <div className="detail-col detail-col--info">
              {datos.cruzRoja != null && <CruzRojaCard cruzRoja={datos.cruzRoja} />}

              <WebcamCard webcam={datos.webcam} />

              <BeachInfoSection datos={datos} />
              {datos.atributos && (
                <BeachAttributesSection
                  atributos={{ ...datos.atributos, ...(datos.submarinismo ? { submarinismo: true } : {}) }}
                />
              )}
              </div>

              {pred && (
                <MetadataFooter
                  zonaAvisos={pred.zonaAvisos}
                  elaboracion={pred.elaboracion}
                />
              )}

              {fuente && (
                <p className="source-label">
                  {t('detalle.datosMeteo', { fuente: fuente.replace('AEMET_HTML', 'AEMET').replace('AEMET_XML', 'AEMET') })}
                </p>
              )}
            </div>
          </>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default PlayaDetallePage;
