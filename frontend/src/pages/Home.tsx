import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonIcon,
  IonFab,
  IonFabButton,
} from '@ionic/react';
import { flagOutline, locationOutline, mapOutline, searchOutline, umbrellaOutline } from 'ionicons/icons';
import { Playa, getPlayas } from '../services/api';
import { useHistory } from 'react-router-dom';
import './Home.css';

const Home: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[] | null>(null);
  const [filtro, setFiltro] = useState('');
  const [orden, setOrden] = useState<'az' | 'za'>('az');
  const [error, setError] = useState<string | null>(null);
  const history = useHistory();

  useEffect(() => {
    getPlayas()
      .then(setPlayas)
      .catch((err: Error) => setError(err.message));
  }, []);

  const filtrarPlayas = () => {
    if (!playas) return [];

    const f = filtro.toLowerCase();

    const filtradas = playas.filter((p) =>
      p.nombre.toLowerCase().includes(f) || p.municipio.toLowerCase().includes(f)
    );

    return filtradas.sort((a, b) => {
      const comp = a.nombre.localeCompare(b.nombre);
      return orden === 'az' ? comp : -comp;
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="title-toolbar">
          <IonTitle onClick={() => window.location.reload()}>
            <IonIcon icon={umbrellaOutline} /> Playas de Cantabria
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>

        <div className="search-sort-container">
          <IonSearchbar
            value={filtro}
            onIonInput={(e) => setFiltro(e.detail.value!)}
            placeholder="Buscar por nombre o municipio..."
          />
          <IonSelect
            value={orden}
            placeholder="Ordenar"
            onIonChange={(e) => setOrden(e.detail.value)}
            interface="popover"
          >
            <IonSelectOption value="az">A – Z</IonSelectOption>
            <IonSelectOption value="za">Z – A</IonSelectOption>
          </IonSelect>
        </div>

        {error && (
          <IonText color="danger">
            <p className="error-message">{error}</p>
          </IonText>
        )}

        {!playas && !error && (
          <div className="spinner-container">
            <IonSpinner name="crescent" />
          </div>
        )}

        {playas &&
          filtrarPlayas().map((playa) => (
            <IonCard
              key={playa.codigo}
              button={true}
              onClick={() => history.push(`/playas/${playa.codigo}`)}
            >
              <IonCardHeader>
                <IonCardTitle>
                  <IonIcon icon={locationOutline} /> {playa.nombre}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p>Municipio: {playa.municipio}</p>
                {playa.idCruzRoja !== 0 && (
                  <p className="section-title">
                    <IonIcon icon={flagOutline} color="danger" /> Vigilada por Cruz Roja
                  </p>
                )}
              </IonCardContent>
            </IonCard>
          ))}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton
            className="fab-mapa-grande"
            routerLink="/mapa"
            title="Ver mapa general"
          >
            <IonIcon icon={mapOutline} />
          </IonFabButton>
        </IonFab>



      </IonContent>
    </IonPage>
  );
};

export default Home;
