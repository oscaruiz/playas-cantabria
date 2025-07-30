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
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import {
  getDetallePlaya,
  PlayaDetalle as PlayaDetalleData,
  PrediccionDia,
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

const PlayaDetallePage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const [datos, setDatos] = useState<PlayaDetalleData | null>(null);
  const [hoy, setHoy] = useState<PrediccionDia | null>(null);
  const [manana, setManana] = useState<PrediccionDia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mananaExpanded, setMananaExpanded] = useState(false);

  useEffect(() => {
    getDetallePlaya(codigo)
      .then((data) => {
        setDatos(data);
        const dias = data?.aemet?.prediccion?.dia ?? [];
        setHoy(dias[0] ?? null);
        setManana(dias[1] ?? null);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [codigo]);

  function formatearFecha(fechaNum: number): string {
    const fechaStr = fechaNum.toString();
    const year = parseInt(fechaStr.slice(0, 4));
    const month = parseInt(fechaStr.slice(4, 6)) - 1;
    const day = parseInt(fechaStr.slice(6, 8));
    const date = new Date(year, month, day);
    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

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

        {hoy && (
          <IonCard className="tropical">
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={todayOutline} /> Hoy ({formatearFecha(hoy.fecha)})
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem lines="none">
                <IonIcon icon={cloudOutline} slot="start" />
                <IonLabel>Cielo: {hoy.estadoCielo.descripcion1}</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={sunnyOutline} slot="start" />
                <IonLabel>Viento: {hoy.viento.descripcion1}</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={water} slot="start" />
                <IonLabel>Oleaje: {limpiarTexto(hoy.oleaje.descripcion1)}</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={water} slot="start" />
                <IonLabel>Temperatura agua: {hoy.tagua.valor1} ºC</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={flameOutline} slot="start" />
                <IonLabel>Temperatura máxima: {hoy.tmaxima.valor1} ºC</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={flameOutline} slot="start" />
                <IonLabel>Sensación térmica: {hoy.stermica.descripcion1}</IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonIcon icon={warningOutline} slot="start" />
                <IonLabel>Índice UV: {hoy.uvMax.valor1}</IonLabel>
              </IonItem>
            </IonCardContent>
          </IonCard>
        )}

        {manana && (
          <IonCard className="tropical">
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={calendarClearOutline} /> Mañana ({formatearFecha(manana.fecha)})
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={() => setMananaExpanded(!mananaExpanded)}
                  style={{ float: 'right' }}
                >
                  {mananaExpanded ? '▲' : '▼'}
                </IonButton>
              </IonCardTitle>
            </IonCardHeader>
            {mananaExpanded && (
              <IonCardContent>
                <IonItem lines="none">
                  <IonIcon icon={cloudOutline} slot="start" />
                  <IonLabel>Cielo: {manana.estadoCielo.descripcion1}</IonLabel>
                </IonItem>
                <IonItem lines="none">
                  <IonIcon icon={sunnyOutline} slot="start" />
                  <IonLabel>Viento: {manana.viento.descripcion1}</IonLabel>
                </IonItem>
                <IonItem lines="none">
                  <IonIcon icon={water} slot="start" />
                  <IonLabel>Oleaje: {limpiarTexto(manana.oleaje.descripcion1)}</IonLabel>
                </IonItem>
                <IonItem lines="none">
                  <IonIcon icon={water} slot="start" />
                  <IonLabel>Temperatura agua: {manana.tagua.valor1} ºC</IonLabel>
                </IonItem>
                <IonItem lines="none">
                  <IonIcon icon={flameOutline} slot="start" />
                  <IonLabel>Temperatura máxima: {manana.tmaxima.valor1} ºC</IonLabel>
                </IonItem>
                <IonItem lines="none">
                  <IonIcon icon={flameOutline} slot="start" />
                  <IonLabel>Sensación térmica: {manana.stermica.descripcion1}</IonLabel>
                </IonItem>
                <IonItem lines="none">
                  <IonIcon icon={warningOutline} slot="start" />
                  <IonLabel>Índice UV: {manana.uvMax.valor1}</IonLabel>
                </IonItem>
              </IonCardContent>
            )}
          </IonCard>
        )}

        {datos?.idCruzRoja !== 0 && datos?.cruzRoja?.bandera && datos.cruzRoja.bandera !== 'Desconocida' && (
          <IonCard className="tropical">
            <IonCardHeader>
              <IonCardTitle>
                <IonIcon icon={flagOutline} /> Datos Cruz Roja
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem lines="none">
                <IonIcon icon={flagOutline} slot="start" />
                <IonLabel>Bandera actual: {iconoBandera(datos.cruzRoja.bandera)} {datos.cruzRoja.bandera}</IonLabel>
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
    </IonPage>
  );
};

export default PlayaDetallePage;
