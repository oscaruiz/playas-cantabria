import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
} from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import {
  getDetallePlaya,
  PlayaDetalle as PlayaDetalleData,
  DiaPrediccionDTO,
  HalfDayDTO,
  PrediccionCompletaDTO,
} from '../services/api';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import './PlayaDetalle.css';
import {
  limpiarTexto,
  flagColorClass,
  isFlagAvailable,
  capitalizar,
  emojiCielo,
  getActiveAttrs,
} from '../utils/beachHelpers';
import { useIdioma, Idioma, TraducirFn } from '../i18n/IdiomaContext';
import { ClaveTexto } from '../i18n/es';
import { traducirTextoApi, claveBandera } from '../i18n/apiText';
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
  if (!isFlagAvailable(cruzRoja)) {
    return null;
  }

  const colorClass = flagColorClass(cruzRoja!.bandera);

  return (
    <div className="flag-banner">
      <div className={`flag-indicator ${colorClass}`}>
        <span className="flag-icon-inner" role="img" aria-label={t('detalle.banderaAria')}>&#9873;</span>
      </div>
      <div className="flag-info">
        <div className="flag-label">{t('detalle.estadoBano')}</div>
        <div className="flag-value">{t(claveBandera(cruzRoja!.bandera))}</div>
        {cruzRoja!.horario && (
          <div className="flag-horario">{t('detalle.vigilancia', { horario: cruzRoja!.horario })}</div>
        )}
      </div>
    </div>
  );
};

const QuickStats: React.FC<{
  clima: PlayaDetalleData['clima'];
  prediccion?: PrediccionCompletaDTO;
}> = ({ clima, prediccion }) => {
  const { t, idioma } = useIdioma();
  const day0 = prediccion?.dias[0];

  const temp = day0?.temperaturaMaxima ?? clima?.hoy.temperature;
  const agua = day0?.temperaturaAgua ?? clima?.hoy.waterTemperature;
  const viento = day0?.tarde.viento ?? day0?.manana.viento ?? clima?.hoy.wind;

  if (temp == null && agua == null && !viento) return null;

  return (
    <div className="quick-stats">
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label={t('detalle.temperatura')}>&#x1F321;&#xFE0F;</div>
        <div className="quick-stat-value">{temp != null ? `${temp}\u00B0` : '--'}</div>
        <div className="quick-stat-label">{t('detalle.temp')}</div>
      </div>
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label={t('detalle.agua')}>&#x1F30A;</div>
        <div className="quick-stat-value">{agua != null ? `${agua}\u00B0` : '--'}</div>
        <div className="quick-stat-label">{t('detalle.agua')}</div>
      </div>
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label={t('detalle.viento')}>&#x1F4A8;</div>
        <div className="quick-stat-value">{viento ? traducirTextoApi(viento, idioma) : '--'}</div>
        <div className="quick-stat-label">{t('detalle.viento')}</div>
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

// ---- Day Selector (pill tabs) ----

const DaySelector: React.FC<{
  fechas: string[];
  selectedDay: number;
  onSelect: (i: number) => void;
}> = ({ fechas, selectedDay, onSelect }) => {
  const { t, idioma } = useIdioma();
  return (
    <div className="day-selector">
      {fechas.map((fecha, i) => (
        <button
          key={fecha}
          className={`day-pill${i === selectedDay ? ' active' : ''}`}
          onClick={() => onSelect(i)}
        >
          <span className="day-pill-title">{dayTitle(fecha, t, idioma)}</span>
          <span className="day-pill-date">{daySubtitle(fecha, idioma)}</span>
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

/** CSS animation duration (seconds) per wind level. Level 0 = paused. */
const WIND_DURATIONS = [0, 4, 2, 1, 0.5];

const WindTurbine: React.FC<{ level: number; label: string }> = ({ level, label }) => {
  const { t } = useIdioma();
  const duration = WIND_DURATIONS[level] ?? 2;
  const paused = level === 0;

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

  return (
    <div className="detail-card forecast-hero">
      <div className="forecast-hero-main">
        <div className="forecast-hero-col">
          <span className="forecast-hero-icon-emoji">{skyEmoji}</span>
          {tempPrincipal != null && (
            <span className="forecast-hero-temp">{Math.round(tempPrincipal)}&deg;</span>
          )}
          {showMax && (
            <span className="forecast-hero-max">{t('detalle.max')} {dia.temperaturaMaxima}&deg;</span>
          )}
          {skyText && <span className="forecast-hero-sky">{traducirTextoApi(skyText, idioma)}</span>}
        </div>
        {viento && <WindTurbine level={wLevel} label={traducirTextoApi(viento, idioma)} />}
        {oleaje && <WavesIndicator label={traducirTextoApi(oleaje, idioma)} />}
      </div>
      <div className="forecast-hero-badges">
        {dia.temperaturaAgua != null && (
          <span className="forecast-badge badge-water">{'\u{1F4A7}'} {t('detalle.aguaGrados', { temp: dia.temperaturaAgua })}</span>
        )}
      </div>
    </div>
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
    const emoji = period === 'morning' ? '\u2600\uFE0F' : '\u{1F305}';
    return (
      <div className={`halfday-block ${period}`}>
        <div className="halfday-block-header">
          <span className="halfday-block-emoji">{emoji}</span>
          <span className="halfday-block-label">{label}</span>
        </div>
        <div className="halfday-block-rows">
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon">{emojiCielo(data.cielo)}</span>
            <span>{traducirTextoApi(capitalizar(data.cielo), idioma) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon">{'\u{1F4A8}'}</span>
            <span>{traducirTextoApi(capitalizar(data.viento), idioma) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon">{'\u{1F30A}'}</span>
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
            <span className="daily-stat-icon">{'\u{1F525}'}</span>
            <span className="daily-stat-label">{t('detalle.sensacionTermica')}</span>
            <span className="daily-stat-value">{traducirTextoApi(capitalizar(dia.sensacionTermica), idioma)}</span>
          </div>
        )}
        {dia.indiceUV != null && (
          <div className="daily-stat-row">
            <span className="daily-stat-icon">{'\u2600'}</span>
            <span className="daily-stat-label">{t('detalle.indiceUV')}</span>
            <span className={`uv-badge ${uvColorClass(dia.indiceUV)}`}>
              {dia.indiceUV}
              {dia.nivelUV && ` \u2014 ${traducirTextoApi(dia.nivelUV.replace(/^índice ultravioleta\s*/i, ''), idioma)}`}
            </span>
          </div>
        )}
        {dia.aviso && dia.aviso.descripcion && (
          <div className="daily-stat-row">
            <span className="daily-stat-icon">
              {dia.aviso.nivel != null && dia.aviso.nivel <= 3 ? '\u26A0\uFE0F' : '\u2705'}
            </span>
            <span className="daily-stat-label">{t('detalle.avisoLitoral')}</span>
            <span className={`daily-stat-value ${avisoLevelClass(dia.aviso.nivel)}`}>
              {traducirTextoApi(capitalizar(dia.aviso.descripcion), idioma)}
            </span>
          </div>
        )}
      </div>
  );

  if (embedded) return body;
  return <div className="detail-card daily-stats-card">{body}</div>;
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
    <div className="detail-card tides-section">
      <div className="tides-section-header">
        <div className="card-header-icon tides">{'\u{1F30A}'}</div>
        <div className="tides-section-header-text">
          <div className="card-header-title">{t('detalle.mareas')}</div>
          {status && (
            <div className={`tide-status ${status.className}`}>
              {status.className === 'tide-status-rising' ? '\u2197' : '\u2198'} {t(status.clave)}
            </div>
          )}
        </div>
      </div>
      <div className="tides-list">
        {entries.map((entry, i) => (
          <div className={`tide-entry ${entry.type}`} key={i}>
            <span className={`tide-arrow ${entry.type === 'pleamar' ? 'up' : 'down'}`}>
              {entry.type === 'pleamar' ? '\u2B06' : '\u2B07'}
            </span>
            <span className="tide-label">{entry.type === 'pleamar' ? t('marea.pleamar') : t('marea.bajamar')}</span>
            <span className="tide-time-value">{entry.time}</span>
          </div>
        ))}
      </div>
      {fuenteMareas && (
        <div className="tides-source">{fuenteMareas.replace(/^\*/, '')}</div>
      )}
    </div>
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

// ---- Legacy WeatherCard (fallback when no prediccionCompleta) ----

interface WeatherCardProps {
  title: string;
  subtitle?: string;
  iconClass: string;
  clima: PlayaDetalleData['clima'];
  day: 'hoy' | 'manana';
  defaultExpanded?: boolean;
}

const WeatherCard: React.FC<WeatherCardProps> = ({
  title,
  subtitle,
  iconClass,
  clima,
  day,
  defaultExpanded = true,
}) => {
  const { t, idioma } = useIdioma();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = `weather-content-${day}`;
  if (!clima) return null;
  const data = clima[day];
  if (!data) return null;

  return (
    <div className="detail-card">
      <div
        className="card-header"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={`${expanded ? t('detalle.contraer') : t('detalle.expandir')} ${title}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className={`card-header-icon ${iconClass}`} aria-hidden="true">
          {day === 'hoy' ? '\u2600' : '\u26C5'}
        </div>
        <div>
          <div className="card-header-title">
            {title}
            {subtitle && <span className="card-header-subtitle"> &middot; {subtitle}</span>}
          </div>
        </div>
        <span className={`card-header-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">&#9662;</span>
      </div>

      {expanded && (
        <div className="card-body card-body-enter" id={contentId}>
          <div className="weather-rows">
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{emojiCielo(data.summary)}</div>
              <span className="weather-row-label">{t('detalle.cielo')}</span>
              <span className="weather-row-value">{traducirTextoApi(limpiarTexto(data.summary), idioma)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F321}'}</div>
              <span className="weather-row-label">{t('detalle.temperatura')}</span>
              <span className="weather-row-value">{data.temperature} &#176;C</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F30A}'}</div>
              <span className="weather-row-label">{t('detalle.agua')}</span>
              <span className="weather-row-value">{data.waterTemperature} &#176;C</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F525}'}</div>
              <span className="weather-row-label">{t('detalle.sensacion')}</span>
              <span className="weather-row-value">{traducirTextoApi(limpiarTexto(data.sensation), idioma)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F4A8}'}</div>
              <span className="weather-row-label">{t('detalle.viento')}</span>
              <span className="weather-row-value">{traducirTextoApi(limpiarTexto(data.wind), idioma)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F30A}'}</div>
              <span className="weather-row-label">{t('detalle.oleaje')}</span>
              <span className="weather-row-value">{traducirTextoApi(limpiarTexto(data.waves), idioma)}</span>
            </div>
            {data.uvIndex !== undefined && (
              <div className="weather-row">
                <div className="weather-row-icon" aria-hidden="true">{'\u2600'}</div>
                <span className="weather-row-label">{t('detalle.indiceUV')}</span>
                <span className="weather-row-value">{data.uvIndex}</span>
              </div>
            )}
          </div>
        </div>
      )}
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
    <div className="detail-card beach-info-card">
      <div className="card-header" role="heading" aria-level={3}>
        <span className="card-header-icon" aria-hidden="true">{'\u{1F3D6}\uFE0F'}</span>
        <span className="card-header-text">{t('detalle.infoPlaya')}</span>
      </div>
      <div className="beach-info-grid">
        {(datos.longitud || datos.anchura) && (
          <div className="beach-info-row">
            <span className="beach-info-label">{'\u{1F4CF}'} {t('detalle.dimensiones')}</span>
            <span className="beach-info-value">
              {datos.longitud ? `${datos.longitud} m` : '\u2014'}
              {' \u00D7 '}
              {datos.anchura ? `${datos.anchura} m` : '\u2014'}
            </span>
          </div>
        )}
        {datos.tipoPlaya && (
          <div className="beach-info-row">
            <span className="beach-info-label">{'\u{1F3D6}\uFE0F'} {t('detalle.tipo')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.tipoPlaya, idioma)}</span>
          </div>
        )}
        {datos.arena && (
          <div className="beach-info-row">
            <span className="beach-info-label">{'\u{1F3DD}\uFE0F'} {t('detalle.arena')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.arena, idioma)}</span>
          </div>
        )}
        {datos.acceso && datos.acceso.length > 0 && (
          <div className="beach-info-row">
            <span className="beach-info-label">{'\u{1F6B6}'} {t('detalle.acceso')}</span>
            <span className="beach-info-value beach-info-chips">
              {datos.acceso.map((a) => (
                <span key={a} className="beach-info-chip">{traducirTextoApi(a, idioma)}</span>
              ))}
            </span>
          </div>
        )}
        {datos.parkingDescripcion && (
          <div className="beach-info-row">
            <span className="beach-info-label">{'\u{1F17F}\uFE0F'} {t('detalle.parking')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.parkingDescripcion, idioma)}</span>
          </div>
        )}
        {datos.bus && (
          <div className="beach-info-row">
            <span className="beach-info-label">{'\u{1F68C}'} {t('detalle.bus')}</span>
            <span className="beach-info-value">{traducirTextoApi(datos.bus, idioma)}</span>
          </div>
        )}
        {datos.hospitalDistancia != null && (
          <div className="beach-info-row">
            <span className="beach-info-label">{'\u{1F3E5}'} {t('detalle.hospital')}</span>
            <span className="beach-info-value">{t('comun.aKm', { km: datos.hospitalDistancia })}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Beach Attributes Section ----

const BeachAttributesSection: React.FC<{ atributos: PlayaDetalleData['atributos'] }> = ({ atributos }) => {
  const { t } = useIdioma();
  const attrs = getActiveAttrs(atributos);
  if (attrs.length === 0) return null;

  return (
    <div className="detail-card attr-card">
      <div
        className="card-header"
        role="heading"
        aria-level={3}
      >
        <span className="card-header-icon" aria-hidden="true">{'\u2139\uFE0F'}</span>
        <span className="card-header-text">{t('detalle.servicios')}</span>
      </div>
      <div className="attr-chips">
        {attrs.map((a) => {
          const label = t(`attr.${a.key}` as ClaveTexto);
          return (
            <span key={a.key} className="attr-chip" aria-label={label}>
              <span aria-hidden="true">{a.emoji}</span> {label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---- Cruz Roja Card (unchanged) ----

const CruzRojaCard: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  const { t, idioma } = useIdioma();
  const hasData = isFlagAvailable(cruzRoja);
  const [expanded, setExpanded] = useState(hasData);

  return (
    <div className="detail-card">
      <div
        className={`card-header${!hasData ? ' card-header-disabled' : ''}`}
        onClick={hasData ? () => setExpanded((v) => !v) : undefined}
        role={hasData ? 'button' : undefined}
        tabIndex={hasData ? 0 : undefined}
        aria-expanded={hasData ? expanded : undefined}
        aria-controls={hasData ? 'cruzroja-content' : undefined}
        aria-label={hasData ? `${expanded ? t('detalle.contraer') : t('detalle.expandir')} ${t('comun.cruzRoja')}` : undefined}
        aria-disabled={!hasData ? true : undefined}
        onKeyDown={hasData ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        } : undefined}
      >
        <div className={`card-header-icon ${hasData ? 'cruz-roja' : 'cruz-roja-neutral'}`} aria-hidden="true">{'\u271A'}</div>
        <div>
          <div className="card-header-title">{t('comun.cruzRoja')}</div>
          <div className="card-header-subtitle">{hasData ? t('cruzroja.vigilanciaCobertura') : t('cruzroja.sinInfo')}</div>
        </div>
        {hasData && <span className={`card-header-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">&#9662;</span>}
      </div>

      {expanded && (
        <div className="card-body card-body-enter" id="cruzroja-content">
          <div className="info-rows">
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F6A9}'}</div>
              <span className="info-row-label">{t('cruzroja.banderaActual')}</span>
              <span className={`info-row-value ${!hasData ? 'muted' : ''}`}>
                {hasData ? traducirTextoApi(cruzRoja!.bandera, idioma) : t('comun.noDisponible')}
              </span>
            </div>
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F4C5}'}</div>
              <span className="info-row-label">{t('cruzroja.coberturaDesde')}</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaDesde ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaDesde, t)}
              </span>
            </div>
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F4C5}'}</div>
              <span className="info-row-label">{t('cruzroja.coberturaHasta')}</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaHasta ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaHasta, t)}
              </span>
            </div>
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F552}'}</div>
              <span className="info-row-label">{t('cruzroja.horario')}</span>
              <span className={`info-row-value ${!cruzRoja?.horario ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.horario, t)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Main Page ----

const PlayaDetallePage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const history = useHistory();
  const { t } = useIdioma();
  const [datos, setDatos] = useState<PlayaDetalleData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDetallePlaya(codigo)
      .then(setDatos)
      .catch(() => setError(true));
  }, [codigo]);

  const [selectedDay, setSelectedDay] = useState(0);
  const pred = datos?.prediccionCompleta;
  const fuente = pred?.fuente ?? datos?.clima?.fuente ?? '';
  const safeDayIndex = pred ? Math.min(selectedDay, pred.dias.length - 1) : 0;

  return (
    <IonPage className="playa-detalle-page">
      <div className="pd-sticky-header">
        <button className="pd-back-btn" onClick={() => history.goBack()} aria-label={t('detalle.volver')}>
          <span aria-hidden="true">&#8249;</span>
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
                    {'\uD83E\uDDED'} {t('detalle.comoLlegar')}
                  </a>
                  <button
                    className="hero-directions-link"
                    onClick={() => history.push(`/mapa?lat=${datos.lat}&lon=${datos.lon}&codigo=${datos.codigo}`)}
                  >
                    {'\uD83D\uDDFA\uFE0F'} {t('detalle.verEnMapa')}
                  </button>
                </div>
              )}

              <FlagBanner cruzRoja={datos.cruzRoja} />
            </div>

            {/* DETAIL CARDS */}
            <div className="detail-content">
              {pred && pred.dias.length > 0 ? (
                <>
                  <DaySelector
                    fechas={pred.dias.map((d) => d.fecha)}
                    selectedDay={safeDayIndex}
                    onSelect={setSelectedDay}
                  />
                  <ForecastHero
                    dia={pred.dias[safeDayIndex]}
                    climaActual={isToday(pred.dias[safeDayIndex].fecha) ? datos.temperaturaActual : undefined}
                    tiempoActual={isToday(pred.dias[safeDayIndex].fecha) ? datos.tiempoActual : undefined}
                  />
                  <div className="detail-card prevision-aemet-card">
                    <div className="card-header" role="heading" aria-level={3}>
                      <span className="card-header-icon" aria-hidden="true">{'\u{1F326}️'}</span>
                      <span className="card-header-text">{t('detalle.previsionAemet')}</span>
                    </div>
                    <div className="prevision-aemet-body">
                      <HalfDayDetail
                        manana={pred.dias[safeDayIndex].manana}
                        tarde={pred.dias[safeDayIndex].tarde}
                      />
                      <DailyStats dia={pred.dias[safeDayIndex]} embedded />
                    </div>
                  </div>
                  {pred.mareas?.[safeDayIndex] && (
                    <TidesSection
                      marea={pred.mareas[safeDayIndex]}
                      fuenteMareas={pred.fuenteMareas}
                      isToday={safeDayIndex === 0}
                    />
                  )}
                </>
              ) : (
                <>
                  <WeatherCard
                    title={t('fecha.hoy')}
                    iconClass="weather"
                    clima={datos.clima}
                    day="hoy"
                    defaultExpanded={true}
                  />
                  <WeatherCard
                    title={t('fecha.manana')}
                    iconClass="tomorrow"
                    clima={datos.clima}
                    day="manana"
                    defaultExpanded={false}
                  />
                  {pred?.mareas?.[0] && (
                    <TidesSection
                      marea={pred.mareas[0]}
                      fuenteMareas={pred.fuenteMareas}
                      isToday={true}
                    />
                  )}
                </>
              )}

              {datos.cruzRoja != null && <CruzRojaCard cruzRoja={datos.cruzRoja} />}

              <BeachInfoSection datos={datos} />
              {datos.atributos && (
                <BeachAttributesSection
                  atributos={{ ...datos.atributos, ...(datos.submarinismo ? { submarinismo: true } : {}) }}
                />
              )}

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
