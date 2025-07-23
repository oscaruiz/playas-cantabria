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
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { getDetallePlaya, PlayaDetalle as PlayaDetalleData, PrediccionDia } from '../services/api';

const PlayaDetallePage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const [datos, setDatos] = useState<PlayaDetalleData | null>(null);
  const [hoy, setHoy] = useState<PrediccionDia | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDetallePlaya(codigo)
      .then((data) => {
        setDatos(data);
        const hoyPrediccion = data?.aemet?.prediccion?.dia?.[0] ?? null;
        setHoy(hoyPrediccion);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [codigo]);

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
              <IonCardTitle>Hoy ({hoy.fecha})</IonCardTitle>
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

        {datos?.idCruzRoja !== 0 && datos?.cruzRoja?.bandera !== 'Desconocida' && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Bandera Cruz Roja</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p><strong>Bandera actual:</strong> {datos?.cruzRoja?.bandera}</p>
            </IonCardContent>
          </IonCard>
        )}

      </IonContent>
    </IonPage>
  );
};

export default PlayaDetallePage;
