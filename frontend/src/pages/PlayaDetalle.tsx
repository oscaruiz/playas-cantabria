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
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { getDetallePlaya, PlayaDetalle as PlayaDetalleData, PrediccionDia } from '../services/api';

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
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Hoy ({formatearFecha(hoy.fecha)})</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p><strong>Cielo:</strong> {hoy.estadoCielo.descripcion1}</p>
              <p><strong>Viento:</strong> {hoy.viento.descripcion1}</p>
              <p><strong>Oleaje:</strong> {hoy.oleaje.descripcion1}</p>
              <p><strong>Temperatura agua:</strong> {hoy.tagua.valor1} ºC</p>
              <p><strong>Temperatura máxima:</strong> {hoy.tmaxima.valor1} ºC</p>
              <p><strong>Sensación térmica:</strong> {hoy.stermica.descripcion1}</p>
              <p><strong>Índice UV:</strong> {hoy.uvMax.valor1}</p>
            </IonCardContent>
          </IonCard>
        )}



        {datos?.idCruzRoja !== 0 && datos?.cruzRoja?.bandera && datos.cruzRoja.bandera !== 'Desconocida' && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Bandera Cruz Roja</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p><strong>Bandera actual:</strong> {datos.cruzRoja.bandera}</p>
            </IonCardContent>
          </IonCard>
        )}

                {manana && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>
                Mañana ({formatearFecha(manana.fecha)})
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
                <p><strong>Cielo:</strong> {manana.estadoCielo.descripcion1}</p>
                <p><strong>Viento:</strong> {manana.viento.descripcion1}</p>
                <p><strong>Oleaje:</strong> {manana.oleaje.descripcion1}</p>
                <p><strong>Temperatura agua:</strong> {manana.tagua.valor1} ºC</p>
                <p><strong>Temperatura máxima:</strong> {manana.tmaxima.valor1} ºC</p>
                <p><strong>Sensación térmica:</strong> {manana.stermica.descripcion1}</p>
                <p><strong>Índice UV:</strong> {manana.uvMax.valor1}</p>
              </IonCardContent>
            )}
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default PlayaDetallePage;
