import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSpinner,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import {
  getDetallePlaya,
  PlayaDetalle as PlayaDetalleData,
  DiaPrediccionDTO,
  HalfDayDTO,
  PrediccionCompletaDTO,
} from '../services/api';
import './PlayaDetalle.css';
import {
  limpiarTexto,
  flagColorClass,
  flagDisplayText,
  isFlagAvailable,
  capitalizar,
  emojiCielo,
  getActiveAttrs,
} from '../utils/beachHelpers';

// ---- Helpers ----

function cruzRojaField(value?: string): string {
  if (!value || value.trim() === '' || value === 'N/A') return 'No disponible';
  return value;
}

const DAY_TITLES = ['Hoy', 'Ma\u00f1ana', 'Pasado ma\u00f1ana'];

function daySubtitle(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const dias = ['domingo', 'lunes', 'martes', 'mi\u00e9rcoles', 'jueves', 'viernes', 's\u00e1bado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${capitalizar(dias[d.getDay()])} ${d.getDate()} de ${meses[d.getMonth()]}`;
}

function hasHalfDayData(h: HalfDayDTO): boolean {
  return h.cielo != null || h.viento != null || h.oleaje != null;
}

// ---- Sub-components ----

const FlagBanner: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  if (!isFlagAvailable(cruzRoja)) {
    return null;
  }

  const colorClass = flagColorClass(cruzRoja!.bandera);

  return (
    <div className="flag-banner">
      <div className={`flag-indicator ${colorClass}`}>
        <span className="flag-icon-inner" role="img" aria-label="bandera">&#9873;</span>
      </div>
      <div className="flag-info">
        <div className="flag-label">Estado para bañarse (según Cruz Roja)</div>
        <div className="flag-value">{flagDisplayText(cruzRoja!.bandera)}</div>
        {cruzRoja!.horario && (
          <div className="flag-horario">{'Vigilancia: ' + cruzRoja!.horario}</div>
        )}
      </div>
    </div>
  );
};

const QuickStats: React.FC<{
  clima: PlayaDetalleData['clima'];
  prediccion?: PrediccionCompletaDTO;
}> = ({ clima, prediccion }) => {
  const day0 = prediccion?.dias[0];

  const temp = day0?.temperaturaMaxima ?? clima?.hoy.temperature;
  const agua = day0?.temperaturaAgua ?? clima?.hoy.waterTemperature;
  const viento = day0?.tarde.viento ?? day0?.manana.viento ?? clima?.hoy.wind;

  if (temp == null && agua == null && !viento) return null;

  return (
    <div className="quick-stats">
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label="temperatura">&#x1F321;&#xFE0F;</div>
        <div className="quick-stat-value">{temp != null ? `${temp}\u00B0` : '--'}</div>
        <div className="quick-stat-label">Temp.</div>
      </div>
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label="agua">&#x1F30A;</div>
        <div className="quick-stat-value">{agua != null ? `${agua}\u00B0` : '--'}</div>
        <div className="quick-stat-label">Agua</div>
      </div>
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label="viento">&#x1F4A8;</div>
        <div className="quick-stat-value">{viento || '--'}</div>
        <div className="quick-stat-label">Viento</div>
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

function aemetIconUrl(iconoCielo: number | null): string | null {
  return iconoCielo != null
    ? `https://www.aemet.es/imagenes/png/estado_cielo/${iconoCielo}.png`
    : null;
}

// ---- Day Selector (pill tabs) ----

const DaySelector: React.FC<{
  count: number;
  selectedDay: number;
  onSelect: (i: number) => void;
}> = ({ count, selectedDay, onSelect }) => (
  <div className="day-selector">
    {Array.from({ length: count }, (_, i) => (
      <button
        key={i}
        className={`day-pill${i === selectedDay ? ' active' : ''}`}
        onClick={() => onSelect(i)}
      >
        <span className="day-pill-title">{DAY_TITLES[i] ?? `D\u00eda ${i + 1}`}</span>
        <span className="day-pill-date">{daySubtitle(i)}</span>
      </button>
    ))}
  </div>
);

// ---- Forecast Hero (big icon + temp + badges) ----

const ForecastHero: React.FC<{ dia: DiaPrediccionDTO }> = ({ dia }) => {
  const [imgError, setImgError] = useState(false);
  const iconCode = dia.tarde.iconoCielo ?? dia.manana.iconoCielo;
  const iconUrl = aemetIconUrl(iconCode);
  const skyText = capitalizar(dia.tarde.cielo ?? dia.manana.cielo ?? '');
  const viento = capitalizar(dia.tarde.viento ?? dia.manana.viento ?? '');
  const oleaje = capitalizar(dia.tarde.oleaje ?? dia.manana.oleaje ?? '');

  return (
    <div className="detail-card forecast-hero">
      <div className="forecast-hero-main">
        <div className="forecast-hero-icon-wrap">
          {iconUrl && !imgError ? (
            <img
              className="forecast-hero-icon"
              src={iconUrl}
              alt={skyText}
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="forecast-hero-icon-fallback">{'\u26C5'}</span>
          )}
        </div>
        <div className="forecast-hero-text">
          {dia.temperaturaMaxima != null && (
            <div className="forecast-hero-temp">{dia.temperaturaMaxima}&deg;</div>
          )}
          {skyText && <div className="forecast-hero-sky">{skyText}</div>}
        </div>
      </div>
      <div className="forecast-hero-badges">
        {dia.temperaturaAgua != null && (
          <span className="forecast-badge badge-water">{'\u{1F4A7}'} {dia.temperaturaAgua}&deg;C</span>
        )}
        {viento && (
          <span className="forecast-badge badge-wind">{'\u{1F4A8}'} {viento}</span>
        )}
        {oleaje && (
          <span className="forecast-badge badge-waves">{'\u{1F30A}'} {oleaje}</span>
        )}
        {dia.indiceUV != null && (
          <span className={`forecast-badge badge-uv ${uvColorClass(dia.indiceUV)}`}>
            {'\u2600'} UV {dia.indiceUV}
          </span>
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
  const hasMorning = hasHalfDayData(manana);

  const renderBlock = (data: HalfDayDTO, period: 'morning' | 'afternoon') => {
    const label = period === 'morning' ? 'Ma\u00f1ana' : 'Tarde';
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
            <span>{capitalizar(data.cielo) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon">{'\u{1F4A8}'}</span>
            <span>{capitalizar(data.viento) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon">{'\u{1F30A}'}</span>
            <span>{capitalizar(data.oleaje) || '--'}</span>
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

const DailyStats: React.FC<{ dia: DiaPrediccionDTO }> = ({ dia }) => {
  const hasAny = dia.sensacionTermica || dia.indiceUV != null || (dia.aviso && dia.aviso.descripcion);
  if (!hasAny) return null;

  return (
    <div className="detail-card daily-stats-card">
      <div className="daily-stats-body">
        {dia.sensacionTermica && (
          <div className="daily-stat-row">
            <span className="daily-stat-icon">{'\u{1F525}'}</span>
            <span className="daily-stat-label">{'Sensaci\u00f3n t\u00e9rmica'}</span>
            <span className="daily-stat-value">{capitalizar(dia.sensacionTermica)}</span>
          </div>
        )}
        {dia.indiceUV != null && (
          <div className="daily-stat-row">
            <span className="daily-stat-icon">{'\u2600'}</span>
            <span className="daily-stat-label">{'Indice UV'}</span>
            <span className={`uv-badge ${uvColorClass(dia.indiceUV)}`}>
              {dia.indiceUV}
              {dia.nivelUV && ` \u2014 ${dia.nivelUV.replace(/^índice ultravioleta\s*/i, '')}`}
            </span>
          </div>
        )}
        {dia.aviso && dia.aviso.descripcion && (
          <div className="daily-stat-row">
            <span className="daily-stat-icon">
              {dia.aviso.nivel != null && dia.aviso.nivel <= 3 ? '\u26A0\uFE0F' : '\u2705'}
            </span>
            <span className="daily-stat-label">Aviso litoral</span>
            <span className={`daily-stat-value ${avisoLevelClass(dia.aviso.nivel)}`}>
              {capitalizar(dia.aviso.descripcion)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Tides Section (selected day only, sorted by time) ----

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getTideStatus(
  entries: Array<{ time: string; type: 'pleamar' | 'bajamar'; minutes: number }>,
  isToday: boolean,
): { label: string; className: string } | null {
  if (!isToday || entries.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Buscar entre qué dos eventos estamos
  for (let i = 0; i < entries.length; i++) {
    if (nowMinutes < entries[i].minutes) {
      // Estamos antes de este evento → la marea se dirige hacia él
      const next = entries[i];
      if (next.type === 'pleamar') {
        return { label: 'Subiendo', className: 'tide-status-rising' };
      } else {
        return { label: 'Bajando', className: 'tide-status-falling' };
      }
    }
  }

  // Después del último evento del día: si el último fue pleamar → bajando, y viceversa
  const last = entries[entries.length - 1];
  if (last.type === 'pleamar') {
    return { label: 'Bajando', className: 'tide-status-falling' };
  }
  return { label: 'Subiendo', className: 'tide-status-rising' };
}

const TidesSection: React.FC<{
  marea: { pleamar: string[]; bajamar: string[] };
  fuenteMareas: string | null;
  isToday: boolean;
}> = ({ marea, fuenteMareas, isToday }) => {
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
          <div className="card-header-title">Mareas</div>
          {status && (
            <div className={`tide-status ${status.className}`}>
              {status.className === 'tide-status-rising' ? '\u2197' : '\u2198'} {status.label}
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
            <span className="tide-label">{entry.type === 'pleamar' ? 'Pleamar' : 'Bajamar'}</span>
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
  if (!zonaAvisos && !elaboracion) return null;
  return (
    <div className="forecast-metadata">
      {zonaAvisos && <span>Zona de avisos: {zonaAvisos}</span>}
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
        aria-label={`${expanded ? 'Contraer' : 'Expandir'} ${title}`}
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
              <span className="weather-row-label">Cielo</span>
              <span className="weather-row-value">{limpiarTexto(data.summary)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F321}'}</div>
              <span className="weather-row-label">Temperatura</span>
              <span className="weather-row-value">{data.temperature} &#176;C</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F30A}'}</div>
              <span className="weather-row-label">Agua</span>
              <span className="weather-row-value">{data.waterTemperature} &#176;C</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F525}'}</div>
              <span className="weather-row-label">{'Sensaci\u00f3n'}</span>
              <span className="weather-row-value">{limpiarTexto(data.sensation)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F4A8}'}</div>
              <span className="weather-row-label">Viento</span>
              <span className="weather-row-value">{limpiarTexto(data.wind)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon" aria-hidden="true">{'\u{1F30A}'}</div>
              <span className="weather-row-label">Oleaje</span>
              <span className="weather-row-value">{limpiarTexto(data.waves)}</span>
            </div>
            {data.uvIndex !== undefined && (
              <div className="weather-row">
                <div className="weather-row-icon" aria-hidden="true">{'\u2600'}</div>
                <span className="weather-row-label">{'Indice UV'}</span>
                <span className="weather-row-value">{data.uvIndex}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Beach Attributes Section ----

const BeachAttributesSection: React.FC<{ atributos: PlayaDetalleData['atributos'] }> = ({ atributos }) => {
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
        <span className="card-header-text">{'Servicios y caracter\u00EDsticas'}</span>
      </div>
      <div className="attr-chips">
        {attrs.map((a) => (
          <span key={a.key} className="attr-chip" aria-label={a.label}>
            <span aria-hidden="true">{a.emoji}</span> {a.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ---- Cruz Roja Card (unchanged) ----

const CruzRojaCard: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
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
        aria-label={hasData ? `${expanded ? 'Contraer' : 'Expandir'} Cruz Roja` : undefined}
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
          <div className="card-header-title">Cruz Roja</div>
          <div className="card-header-subtitle">{hasData ? 'Vigilancia y cobertura' : 'Informaci\u00f3n de Cruz Roja a\u00fan no disponible'}</div>
        </div>
        {hasData && <span className={`card-header-chevron ${expanded ? 'open' : ''}`} aria-hidden="true">&#9662;</span>}
      </div>

      {expanded && (
        <div className="card-body card-body-enter" id="cruzroja-content">
          <div className="info-rows">
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F6A9}'}</div>
              <span className="info-row-label">Bandera actual</span>
              <span className={`info-row-value ${!hasData ? 'muted' : ''}`}>
                {hasData ? cruzRoja!.bandera : 'No disponible'}
              </span>
            </div>
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F4C5}'}</div>
              <span className="info-row-label">Cobertura desde</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaDesde ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaDesde)}
              </span>
            </div>
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F4C5}'}</div>
              <span className="info-row-label">Cobertura hasta</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaHasta ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaHasta)}
              </span>
            </div>
            <div className="info-row">
              <div aria-hidden="true" className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F552}'}</div>
              <span className="info-row-label">Horario</span>
              <span className={`info-row-value ${!cruzRoja?.horario ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.horario)}
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
  const [datos, setDatos] = useState<PlayaDetalleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDetallePlaya(codigo)
      .then(setDatos)
      .catch((err: Error) => setError(err.message));
  }, [codigo]);

  const [selectedDay, setSelectedDay] = useState(0);
  const pred = datos?.prediccionCompleta;
  const fuente = pred?.fuente ?? datos?.clima?.fuente ?? '';
  const safeDayIndex = pred ? Math.min(selectedDay, pred.dias.length - 1) : 0;

  return (
    <IonPage className="playa-detalle-page">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" text="" />
          </IonButtons>
          <IonTitle>{datos?.nombre || 'Detalle'}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {error && (
          <div className="error-container">
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {!datos && !error && (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <span className="loading-text">Cargando datos de la playa...</span>
          </div>
        )}

        {datos && (
          <>
            {/* HERO SECTION */}
            <div className="hero-section">
              <h1 className="hero-beach-name">{datos.nombre}</h1>
              <p className="hero-municipio">{datos.municipio}</p>

              {datos.lat != null && datos.lon != null && (
                <a
                  className="hero-directions-link"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${datos.lat},${datos.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {'\uD83D\uDCCD'} C&oacute;mo llegar
                </a>
              )}

              <FlagBanner cruzRoja={datos.cruzRoja} />
            </div>

            {/* DETAIL CARDS */}
            <div className="detail-content">
              {pred && pred.dias.length > 0 ? (
                <>
                  <DaySelector
                    count={pred.dias.length}
                    selectedDay={safeDayIndex}
                    onSelect={setSelectedDay}
                  />
                  <ForecastHero dia={pred.dias[safeDayIndex]} />
                  <HalfDayDetail
                    manana={pred.dias[safeDayIndex].manana}
                    tarde={pred.dias[safeDayIndex].tarde}
                  />
                  <DailyStats dia={pred.dias[safeDayIndex]} />
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
                    title="Hoy"
                    iconClass="weather"
                    clima={datos.clima}
                    day="hoy"
                    defaultExpanded={true}
                  />
                  <WeatherCard
                    title={'Ma\u00f1ana'}
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

              {datos.atributos && <BeachAttributesSection atributos={datos.atributos} />}

              {pred && (
                <MetadataFooter
                  zonaAvisos={pred.zonaAvisos}
                  elaboracion={pred.elaboracion}
                />
              )}

              {fuente && (
                <p className="source-label">
                  Datos {'meteorol\u00f3gicos'}: {fuente.replace('AEMET_HTML', 'AEMET').replace('AEMET_XML', 'AEMET')}
                </p>
              )}
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default PlayaDetallePage;
