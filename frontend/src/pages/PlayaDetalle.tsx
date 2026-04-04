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

// ---- Helpers ----

function limpiarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto.replace(/\uFFFD/g, 'e');
}

function flagColorClass(bandera?: string): string {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('roja')) return 'red';
  if (b.includes('amarilla')) return 'yellow';
  if (b.includes('verde')) return 'green';
  return 'unknown';
}

function flagDisplayText(bandera?: string): string {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('roja')) return 'Bandera Roja';
  if (b.includes('amarilla')) return 'Bandera Amarilla';
  if (b.includes('verde')) return 'Bandera Verde';
  return 'Sin datos';
}

function isFlagAvailable(cruzRoja?: PlayaDetalleData['cruzRoja']): boolean {
  if (!cruzRoja) return false;
  const b = cruzRoja.bandera?.toLowerCase() || '';
  return b.includes('roja') || b.includes('amarilla') || b.includes('verde');
}

function cruzRojaField(value?: string): string {
  if (!value || value.trim() === '' || value === 'N/A') return 'No disponible';
  return value;
}

function capitalizar(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const DAY_TITLES = ['Hoy', 'Ma\u00f1ana', 'Pasado ma\u00f1ana'];

function hasHalfDayData(h: HalfDayDTO): boolean {
  return h.cielo != null || h.viento != null || h.oleaje != null;
}

// ---- Sub-components ----

const FlagBanner: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  if (!isFlagAvailable(cruzRoja)) {
    return (
      <div className="no-flag-banner">
        <span className="no-flag-icon" aria-hidden="true">&#9872;</span>
        <div className="no-flag-info">
          <div className="no-flag-label">Estado de la playa</div>
          <div className="no-flag-value">No disponible</div>
        </div>
      </div>
    );
  }

  const colorClass = flagColorClass(cruzRoja!.bandera);

  return (
    <div className="flag-banner">
      <div className={`flag-indicator ${colorClass}`}>
        <span className="flag-icon-inner" role="img" aria-label="bandera">&#9873;</span>
      </div>
      <div className="flag-info">
        <div className="flag-label">Estado de la playa</div>
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

// ---- Half-day column (used inside the 2-col grid) ----

const HalfDayColumn: React.FC<{
  label: string;
  data: HalfDayDTO;
}> = ({ label, data }) => (
  <div className="halfday-col">
    <div className="halfday-col-label">{label}</div>
    <div className="halfday-col-row">
      <span className="halfday-col-icon">{'\u2601'}</span>
      <span>{capitalizar(data.cielo) || '--'}</span>
    </div>
    <div className="halfday-col-row">
      <span className="halfday-col-icon">{'\u{1F4A8}'}</span>
      <span>{capitalizar(data.viento) || '--'}</span>
    </div>
    <div className="halfday-col-row">
      <span className="halfday-col-icon">{'\u{1F30A}'}</span>
      <span>{capitalizar(data.oleaje) || '--'}</span>
    </div>
  </div>
);

// ---- Aviso badge ----

function avisoLevelClass(nivel: number | null): string {
  if (nivel === 1) return 'aviso-red';
  if (nivel === 2) return 'aviso-orange';
  if (nivel === 3) return 'aviso-yellow';
  return 'aviso-green';
}

// ---- Forecast Day Card ----

const ForecastDayCard: React.FC<{
  dia: DiaPrediccionDTO;
  index: number;
  defaultExpanded?: boolean;
}> = ({ dia, index, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const iconClass = index === 0 ? 'weather' : 'tomorrow';
  const icon = index === 0 ? '\u2600' : '\u26C5';
  const title = DAY_TITLES[index] ?? capitalizar(dia.fecha);

  const hasMorning = hasHalfDayData(dia.manana);

  return (
    <div className="detail-card">
      <div
        className="card-header"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className={`card-header-icon ${iconClass}`}>{icon}</div>
        <div>
          <div className="card-header-title">{title}</div>
          <div className="card-header-subtitle">{dia.fecha}{!hasMorning ? ' \u00B7 solo tarde' : ''}</div>
        </div>
        <span className={`card-header-chevron ${expanded ? 'open' : ''}`}>&#9662;</span>
      </div>

      {expanded && (
        <div className="card-body card-body-enter">
          {/* Morning / Afternoon grid */}
          <div className={`halfday-grid ${hasMorning ? 'two-cols' : 'one-col'}`}>
            {hasMorning && <HalfDayColumn label={'\u2600\uFE0F Ma\u00f1ana'} data={dia.manana} />}
            <HalfDayColumn label={'\u{1F305} Tarde'} data={dia.tarde} />
          </div>

          {/* Daily aggregate stats */}
          <div className="day-stats">
            {dia.temperaturaMaxima != null && (
              <div className="day-stat">
                <span className="day-stat-icon">{'\u{1F321}'}</span>
                <span className="day-stat-label">Temperatura</span>
                <span className="day-stat-value">{dia.temperaturaMaxima} &#176;C</span>
              </div>
            )}
            {dia.temperaturaAgua != null && (
              <div className="day-stat">
                <span className="day-stat-icon">{'\u{1F30A}'}</span>
                <span className="day-stat-label">Agua</span>
                <span className="day-stat-value">{dia.temperaturaAgua} &#176;C</span>
              </div>
            )}
            {dia.sensacionTermica && (
              <div className="day-stat">
                <span className="day-stat-icon">{'\u{1F525}'}</span>
                <span className="day-stat-label">{'Sensaci\u00f3n'}</span>
                <span className="day-stat-value">{capitalizar(dia.sensacionTermica)}</span>
              </div>
            )}
            {dia.indiceUV != null && (
              <div className="day-stat">
                <span className="day-stat-icon">{'\u2600'}</span>
                <span className="day-stat-label">{'Indice UV'}</span>
                <span className="day-stat-value">
                  {dia.indiceUV}
                  {dia.nivelUV && (
                    <span className="uv-level"> ({dia.nivelUV.replace(/^índice ultravioleta\s*/i, '')})</span>
                  )}
                </span>
              </div>
            )}
            {dia.aviso && dia.aviso.descripcion && (
              <div className="day-stat">
                <span className="day-stat-icon">{dia.aviso.nivel != null && dia.aviso.nivel <= 3 ? '\u26A0\uFE0F' : '\u2705'}</span>
                <span className="day-stat-label">Aviso</span>
                <span className={`day-stat-value ${avisoLevelClass(dia.aviso.nivel)}`}>
                  {capitalizar(dia.aviso.descripcion)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Tides Card (horizontal 3-column grid) ----

const TidesCard: React.FC<{
  prediccion: PrediccionCompletaDTO;
}> = ({ prediccion }) => {
  const [expanded, setExpanded] = useState(false);

  if (!prediccion.mareas || prediccion.mareas.length === 0) return null;

  return (
    <div className="detail-card">
      <div
        className="card-header"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="card-header-icon tides">{'\u{1F30A}'}</div>
        <div>
          <div className="card-header-title">Mareas</div>
          <div className="card-header-subtitle">Pleamar y bajamar</div>
        </div>
        <span className={`card-header-chevron ${expanded ? 'open' : ''}`}>&#9662;</span>
      </div>

      {expanded && (
        <div className="card-body card-body-enter">
          <div className="tides-columns">
            {prediccion.mareas.map((marea, i) => {
              const diaLabel = prediccion.dias[i]?.fecha ?? `D\u00eda ${i + 1}`;
              return (
                <div className="tide-column" key={i}>
                  <div className="tide-column-label">{capitalizar(diaLabel)}</div>
                  {marea.pleamar.map((t, j) => (
                    <div className="tide-time pleamar" key={`p${j}`}>{'\u2B06'} {t}</div>
                  ))}
                  {marea.bajamar.map((t, j) => (
                    <div className="tide-time bajamar" key={`b${j}`}>{'\u2B07'} {t}</div>
                  ))}
                </div>
              );
            })}
          </div>
          {prediccion.fuenteMareas && (
            <div className="tides-source">{prediccion.fuenteMareas.replace(/^\*/, '')}</div>
          )}
        </div>
      )}
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
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className={`card-header-icon ${iconClass}`}>
          {day === 'hoy' ? '\u2600' : '\u26C5'}
        </div>
        <div>
          <div className="card-header-title">
            {title}
            {subtitle && <span className="card-header-subtitle"> &middot; {subtitle}</span>}
          </div>
        </div>
        <span className={`card-header-chevron ${expanded ? 'open' : ''}`}>&#9662;</span>
      </div>

      {expanded && (
        <div className="card-body card-body-enter">
          <div className="weather-rows">
            <div className="weather-row">
              <div className="weather-row-icon">{'\u2601'}</div>
              <span className="weather-row-label">Cielo</span>
              <span className="weather-row-value">{limpiarTexto(data.summary)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon">{'\u{1F321}'}</div>
              <span className="weather-row-label">Temperatura</span>
              <span className="weather-row-value">{data.temperature} &#176;C</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon">{'\u{1F30A}'}</div>
              <span className="weather-row-label">Agua</span>
              <span className="weather-row-value">{data.waterTemperature} &#176;C</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon">{'\u{1F525}'}</div>
              <span className="weather-row-label">{'Sensaci\u00f3n'}</span>
              <span className="weather-row-value">{limpiarTexto(data.sensation)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon">{'\u{1F4A8}'}</div>
              <span className="weather-row-label">Viento</span>
              <span className="weather-row-value">{limpiarTexto(data.wind)}</span>
            </div>
            <div className="weather-row">
              <div className="weather-row-icon">{'\u{1F30A}'}</div>
              <span className="weather-row-label">Oleaje</span>
              <span className="weather-row-value">{limpiarTexto(data.waves)}</span>
            </div>
            {data.uvIndex !== undefined && (
              <div className="weather-row">
                <div className="weather-row-icon">{'\u2600'}</div>
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

// ---- Cruz Roja Card (unchanged) ----

const CruzRojaCard: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  const [expanded, setExpanded] = useState(true);
  const hasData = isFlagAvailable(cruzRoja);

  return (
    <div className="detail-card">
      <div
        className="card-header"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className={`card-header-icon ${hasData ? 'cruz-roja' : 'cruz-roja-neutral'}`}>{'\u2695'}</div>
        <div>
          <div className="card-header-title">Cruz Roja</div>
          <div className="card-header-subtitle">{hasData ? 'Vigilancia y cobertura' : 'Sin cobertura activa'}</div>
        </div>
        <span className={`card-header-chevron ${expanded ? 'open' : ''}`}>&#9662;</span>
      </div>

      {expanded && (
        <div className="card-body card-body-enter">
          <div className="info-rows">
            <div className="info-row">
              <div className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F6A9}'}</div>
              <span className="info-row-label">Bandera actual</span>
              <span className={`info-row-value ${!hasData ? 'muted' : ''}`}>
                {hasData ? cruzRoja!.bandera : 'No disponible'}
              </span>
            </div>
            <div className="info-row">
              <div className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F4C5}'}</div>
              <span className="info-row-label">Cobertura desde</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaDesde ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaDesde)}
              </span>
            </div>
            <div className="info-row">
              <div className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F4C5}'}</div>
              <span className="info-row-label">Cobertura hasta</span>
              <span className={`info-row-value ${!cruzRoja?.coberturaHasta ? 'muted' : ''}`}>
                {cruzRojaField(cruzRoja?.coberturaHasta)}
              </span>
            </div>
            <div className="info-row">
              <div className={`info-row-icon ${hasData ? '' : 'neutral'}`}>{'\u{1F552}'}</div>
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

  const pred = datos?.prediccionCompleta;
  const fuente = pred?.fuente ?? datos?.clima?.fuente ?? '';

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

              <FlagBanner cruzRoja={datos.cruzRoja} />
              <QuickStats clima={datos.clima} prediccion={pred} />
            </div>

            {/* DETAIL CARDS */}
            <div className="detail-content">
              {/* Forecast: use prediccionCompleta if available, else legacy WeatherCards */}
              {pred && pred.dias.length > 0 ? (
                <>
                  {pred.dias.map((dia, i) => (
                    <ForecastDayCard
                      key={dia.fecha}
                      dia={dia}
                      index={i}
                      defaultExpanded={i === 0}
                    />
                  ))}
                  <TidesCard prediccion={pred} />
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
                </>
              )}

              <CruzRojaCard cruzRoja={datos.cruzRoja} />

              {fuente && (
                <p className="source-label">
                  Datos {'meteorol\u00f3gicos'}: {fuente.replace('AEMET_HTML', 'AEMET').replace('AEMET_XML', 'AEMET')}
                  {pred?.elaboracion && (
                    <> &middot; {pred.elaboracion}</>
                  )}
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
