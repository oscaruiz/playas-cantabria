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
} from '../services/api';
import './PlayaDetalle.css';

// ---- Helpers ----

function limpiarTexto(texto: string): string {
  if (!texto) return texto;
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

function formatearFechaNumYYYYMMDD(fechaNum?: number): Date | null {
  if (!fechaNum) return null;
  const s = String(fechaNum);
  const y = parseInt(s.slice(0, 4), 10);
  const m = parseInt(s.slice(4, 6), 10) - 1;
  const d = parseInt(s.slice(6, 8), 10);
  return new Date(y, m, d);
}

function sumarDias(base: Date, dias: number): Date {
  const out = new Date(base);
  out.setDate(out.getDate() + dias);
  return out;
}

function formatearDiaVisual(date: Date): string {
  return date
    .toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
    .replace(/\.$/, '');
}

function fechaPrevision(
  fechaNum?: number,
  ultimaActualizacion?: string,
  offsetDias = 0
): Date | null {
  const byNum = formatearFechaNumYYYYMMDD(fechaNum);
  if (byNum) return byNum;
  if (!ultimaActualizacion) return null;
  const base = new Date(ultimaActualizacion);
  return sumarDias(base, offsetDias);
}

function hasFecha(x: unknown): x is { fecha?: number } {
  return typeof x === 'object' && x !== null && 'fecha' in x;
}

// ---- Sub-components ----

const FlagBanner: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  if (!cruzRoja?.bandera || cruzRoja.bandera === 'Desconocida') {
    return (
      <div className="no-flag-banner">
        <span style={{ fontSize: '1.3rem' }}>&#9872;</span>
        <span>Sin datos de bandera disponibles</span>
      </div>
    );
  }

  const colorClass = flagColorClass(cruzRoja.bandera);

  return (
    <div className="flag-banner">
      <div className={`flag-indicator ${colorClass}`}>
        <span className="flag-icon-inner" role="img" aria-label="bandera">&#9873;</span>
      </div>
      <div className="flag-info">
        <div className="flag-label">Estado de la playa</div>
        <div className="flag-value">{flagDisplayText(cruzRoja.bandera)}</div>
        {cruzRoja.horario && (
          <div className="flag-horario">Vigilancia: {cruzRoja.horario}</div>
        )}
      </div>
    </div>
  );
};

const QuickStats: React.FC<{ clima: PlayaDetalleData['clima'] }> = ({ clima }) => {
  if (!clima) return null;

  return (
    <div className="quick-stats">
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label="temperatura">&#x1F321;&#xFE0F;</div>
        <div className="quick-stat-value">{clima.hoy.temperature}&#176;</div>
        <div className="quick-stat-label">Temp.</div>
      </div>
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label="agua">&#x1F30A;</div>
        <div className="quick-stat-value">{clima.hoy.waterTemperature}&#176;</div>
        <div className="quick-stat-label">Agua</div>
      </div>
      <div className="quick-stat">
        <div className="quick-stat-icon" role="img" aria-label="viento">&#x1F4A8;</div>
        <div className="quick-stat-value">{clima.hoy.wind || '--'}</div>
        <div className="quick-stat-label">Viento</div>
      </div>
    </div>
  );
};

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

const CruzRojaCard: React.FC<{ cruzRoja?: PlayaDetalleData['cruzRoja'] }> = ({ cruzRoja }) => {
  const [expanded, setExpanded] = useState(true);

  if (!cruzRoja?.bandera || cruzRoja.bandera === 'Desconocida') return null;

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
        <div className="card-header-icon cruz-roja">{'\u2695'}</div>
        <div>
          <div className="card-header-title">Cruz Roja</div>
          <div className="card-header-subtitle">Vigilancia y cobertura</div>
        </div>
        <span className={`card-header-chevron ${expanded ? 'open' : ''}`}>&#9662;</span>
      </div>

      {expanded && (
        <div className="card-body card-body-enter">
          <div className="info-rows">
            <div className="info-row">
              <div className="info-row-icon">{'\u{1F6A9}'}</div>
              <span className="info-row-label">Bandera actual</span>
              <span className="info-row-value">{cruzRoja.bandera}</span>
            </div>
            <div className="info-row">
              <div className="info-row-icon">{'\u{1F4C5}'}</div>
              <span className="info-row-label">Cobertura desde</span>
              <span className="info-row-value">{cruzRoja.coberturaDesde || 'N/A'}</span>
            </div>
            <div className="info-row">
              <div className="info-row-icon">{'\u{1F4C5}'}</div>
              <span className="info-row-label">Cobertura hasta</span>
              <span className="info-row-value">{cruzRoja.coberturaHasta || 'N/A'}</span>
            </div>
            <div className="info-row">
              <div className="info-row-icon">{'\u{1F552}'}</div>
              <span className="info-row-label">Horario</span>
              <span className="info-row-value">{cruzRoja.horario || 'N/A'}</span>
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

  const fuente = datos?.clima?.fuente ?? '';

  // Compute date labels
  const hoyLabel = (() => {
    if (!datos?.clima) return '';
    const hoyFechaNum = hasFecha(datos.clima.hoy) ? datos.clima.hoy.fecha : undefined;
    const f = fechaPrevision(hoyFechaNum, datos.clima.ultimaActualizacion, 0);
    return f ? formatearDiaVisual(f) : '';
  })();

  const mananaLabel = (() => {
    if (!datos?.clima) return '';
    const mananaFechaNum = hasFecha(datos.clima.manana) ? datos.clima.manana.fecha : undefined;
    const f = fechaPrevision(mananaFechaNum, datos.clima.ultimaActualizacion, 1);
    return f ? formatearDiaVisual(f) : '';
  })();

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
              <QuickStats clima={datos.clima} />
            </div>

            {/* DETAIL CARDS */}
            <div className="detail-content">
              <WeatherCard
                title="Hoy"
                subtitle={hoyLabel}
                iconClass="weather"
                clima={datos.clima}
                day="hoy"
                defaultExpanded={true}
              />

              <WeatherCard
                title={'Ma\u00f1ana'}
                subtitle={mananaLabel}
                iconClass="tomorrow"
                clima={datos.clima}
                day="manana"
                defaultExpanded={false}
              />

              <CruzRojaCard cruzRoja={datos.cruzRoja} />

              {fuente && (
                <p className="source-label">
                  Datos {'meteorol\u00f3gicos'}: {fuente}
                  {datos.clima?.ultimaActualizacion && (
                    <>
                      {' '}
                      &middot; Actualizado:{' '}
                      {new Date(datos.clima.ultimaActualizacion).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </>
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
