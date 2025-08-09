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
  IonText,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonItem,
  IonLabel,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import {
  getDetallePlaya,
  PlayaDetalle as PlayaDetalleData,
} from '../services/api';
import {
  sunnyOutline,
  cloudOutline,
  water,
  flameOutline,
  warningOutline,
  timeOutline,
  todayOutline,
  calendarClearOutline,
  flagOutline,
  chevronDownOutline,
  chevronUpOutline,
} from 'ionicons/icons';

function limpiarTexto(texto: string): string {
  if (!texto) return texto;
  return texto.replace(/\uFFFD/g, 'é');
}

function iconoBandera(bandera?: string): string {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('roja')) return '🟥';
  if (b.includes('amarilla')) return '🟨';
  if (b.includes('verde')) return '🟩';
  return '⚐';
}

// ---- Helpers de fecha ----
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
    .replace(/\.$/, ''); // quita el punto final de "sáb."
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

// Type guard para objetos con campo opcional 'fecha'
function hasFecha(x: unknown): x is { fecha?: number } {
  return typeof x === 'object' && x !== null && 'fecha' in x;
}

const PlayaDetallePage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const [datos, setDatos] = useState<PlayaDetalleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mananaExpanded, setMananaExpanded] = useState(false);

  useEffect(() => {
    getDetallePlaya(codigo)
      .then((data) => {
        setDatos(data);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [codigo]);

  const fuente = datos?.clima?.fuente ?? '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>
          <IonTitle>{datos?.nombre || 'Detalle de Playa'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {error && (
          <IonText color="danger">
            <p>{error}</p>
          </IonText>
        )}

        {!datos && !error && (
          <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {datos?.clima && (
          <>
            {/* TARJETA HOY */}
            <IonCard className="tropical">
              <IonCardHeader>
                <IonCardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={todayOutline} />
                  <span>Hoy</span>
                  <span className="chip-fecha">
                    {(() => {
                      const hoyFechaNum = hasFecha(datos?.clima?.hoy) ? datos?.clima?.hoy?.fecha : undefined;
                      const f = fechaPrevision(
                        hoyFechaNum,
                        datos?.clima?.ultimaActualizacion,
                        0
                      );
                      return f ? formatearDiaVisual(f) : '';
                    })()}
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#666', fontSize: '0.9rem' }}>
                    Fuente: {fuente}
                  </span>
                </IonCardTitle>
              </IonCardHeader>

              <IonCardContent>
                <IonItem lines="none">
                  <IonIcon icon={cloudOutline} slot="start" />
                  <IonLabel>Cielo: {datos.clima.hoy.summary}</IonLabel>
                </IonItem>

                <IonItem lines="none">
                  <IonIcon icon={flameOutline} slot="start" />
                  <IonLabel>Temperatura: {datos.clima.hoy.temperature} ºC</IonLabel>
                </IonItem>

                <IonItem lines="none">
                  <IonIcon icon={water} slot="start" />
                  <IonLabel>Temperatura agua: {datos.clima.hoy.waterTemperature} ºC</IonLabel>
                </IonItem>

                <IonItem lines="none">
                  <IonIcon icon={flameOutline} slot="start" />
                  <IonLabel>Sensación: {datos.clima.hoy.sensation}</IonLabel>
                </IonItem>

                <IonItem lines="none">
                  <IonIcon icon={sunnyOutline} slot="start" />
                  <IonLabel>Viento: {datos.clima.hoy.wind}</IonLabel>
                </IonItem>

                <IonItem lines="none">
                  <IonIcon icon={water} slot="start" />
                  <IonLabel>Oleaje: {datos.clima.hoy.waves}</IonLabel>
                </IonItem>

                {datos.clima.hoy.uvIndex !== undefined && (
                  <IonItem lines="none">
                    <IonIcon icon={warningOutline} slot="start" />
                    <IonLabel>Índice UV: {datos.clima.hoy.uvIndex}</IonLabel>
                  </IonItem>
                )}

                <IonItem lines="none">
                  <IonIcon icon={timeOutline} slot="start" />
                  <IonLabel>
                    Actualizado:{' '}
                    {datos?.clima?.ultimaActualizacion
                      ? new Date(datos.clima.ultimaActualizacion).toLocaleTimeString()
                      : 'N/A'}
                  </IonLabel>
                </IonItem>
              </IonCardContent>
            </IonCard>

            {/* TARJETA MAÑANA */}
            <IonCard className="tropical">
              <IonCardHeader>
                {/* FILA TAPPABLE GRANDE */}
                <IonItem
                  button
                  detail={false}
                  lines="none"
                  onClick={() => setMananaExpanded((v) => !v)}
                  className="touch-row"
                >
                  <IonIcon icon={calendarClearOutline} slot="start" />
                  <IonLabel className="header-label">
                    <div className="header-line">
                      <strong>Mañana</strong>
                      <span className="chip-fecha">
                        {(() => {
                          const mananaFechaNum = hasFecha(datos?.clima?.manana)
                            ? datos?.clima?.manana?.fecha
                            : undefined;
                          const f = fechaPrevision(
                            mananaFechaNum,
                            datos?.clima?.ultimaActualizacion,
                            1
                          );
                          return f ? formatearDiaVisual(f) : '';
                        })()}
                      </span>
                    </div>
                    <div className="fuente">Fuente: {fuente}</div>
                  </IonLabel>
                  <IonIcon
                    icon={mananaExpanded ? chevronUpOutline : chevronDownOutline}
                    slot="end"
                    className={`chevron ${mananaExpanded ? 'open' : ''}`}
                    aria-hidden="true"
                  />
                </IonItem>
              </IonCardHeader>

              {mananaExpanded && (
                <IonCardContent>
                  <IonItem lines="none">
                    <IonIcon icon={cloudOutline} slot="start" />
                    <IonLabel>Cielo: {datos.clima.manana.summary}</IonLabel>
                  </IonItem>

                  <IonItem lines="none">
                    <IonIcon icon={flameOutline} slot="start" />
                    <IonLabel>Temperatura: {datos.clima.manana.temperature} ºC</IonLabel>
                  </IonItem>

                  <IonItem lines="none">
                    <IonIcon icon={water} slot="start" />
                    <IonLabel>Temperatura agua: {datos.clima.manana.waterTemperature} ºC</IonLabel>
                  </IonItem>

                  <IonItem lines="none">
                    <IonIcon icon={flameOutline} slot="start" />
                    <IonLabel>Sensación: {datos.clima.manana.sensation}</IonLabel>
                  </IonItem>

                  <IonItem lines="none">
                    <IonIcon icon={sunnyOutline} slot="start" />
                    <IonLabel>Viento: {datos.clima.manana.wind}</IonLabel>
                  </IonItem>

                  <IonItem lines="none">
                    <IonIcon icon={water} slot="start" />
                    <IonLabel>Oleaje: {datos.clima.manana.waves}</IonLabel>
                  </IonItem>

                  {datos.clima.manana.uvIndex !== undefined && (
                    <IonItem lines="none">
                      <IonIcon icon={warningOutline} slot="start" />
                      <IonLabel>Índice UV: {datos.clima.manana.uvIndex}</IonLabel>
                    </IonItem>
                  )}
                </IonCardContent>
              )}
            </IonCard>
          </>
        )}

        {datos?.cruzRoja?.bandera && datos.cruzRoja.bandera !== 'Desconocida' && (
          <IonCard className="tropical">
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={flagOutline} /> Datos Cruz Roja
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem lines="none">
                <IonIcon icon={flagOutline} slot="start" />
                <IonLabel>
                  Bandera actual: {iconoBandera(datos.cruzRoja.bandera)} {datos.cruzRoja.bandera}
                </IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={calendarClearOutline} slot="start" />
                <IonLabel>Cobertura desde: {datos.cruzRoja.coberturaDesde || 'N/A'}</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={calendarClearOutline} slot="start" />
                <IonLabel>Cobertura hasta: {datos.cruzRoja.coberturaHasta || 'N/A'}</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={timeOutline} slot="start" />
                <IonLabel>Horario: {datos.cruzRoja.horario || 'N/A'}</IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>

      {/* Estilos inline (puedes moverlos al CSS del proyecto) */}
      <style>{`
        .chip-fecha {
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,0.06);
          font-size: 0.9rem;
          margin-left: 8px;
        }
        .touch-row {
          min-height: 56px; /* mayor área táctil en móvil */
        }
        .header-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .header-line {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fuente {
          color: #666;
          font-size: 0.9rem;
        }
        .chevron {
          transition: transform 0.2s ease;
          font-size: 24px;
        }
        .chevron.open {
          transform: rotate(180deg);
        }
      `}</style>
    </IonPage>
  );
};

export default PlayaDetallePage;
