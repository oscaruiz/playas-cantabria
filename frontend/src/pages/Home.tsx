import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonSearchbar,
} from '@ionic/react';
import { Playa, getPlayas } from '../services/api';
import { useHistory } from 'react-router-dom';

const Home: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[] | null>(null);
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState<string | null>(null);
  const history = useHistory();

  useEffect(() => {
    getPlayas()
      .then(setPlayas)
      .catch((err: Error) => setError(err.message));
  }, []);

  const filtrarPlayas = () => {
    if (!playas) return [];
    return playas.filter((p) =>
      p.nombre.toLowerCase().includes(filtro.toLowerCase())
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Playas de Cantabria</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonSearchbar
          value={filtro}
          onIonInput={(e) => setFiltro(e.detail.value!)}
          placeholder="Buscar playa..."
        />

        {error && (
          <IonText color="danger">
            <p style={{ padding: '1rem' }}>{error}</p>
          </IonText>
        )}

        {!playas && !error && (
          <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {playas && (
          <IonList>
            {filtrarPlayas().map((playa) => (
              <IonItem
                button
                key={playa.codigo}
                onClick={() => history.push(`/playas/${playa.codigo}`)}
              >
                <IonLabel>
                  <h2>{playa.nombre}</h2>
                  <p>Municipio: {playa.municipio}</p>
                </IonLabel>

                {playa.idCruzRoja !== 0 && (
                  <div
                    slot="end"
                    style={{
                      color: 'red',
                      fontSize: '20px',
                      fontWeight: 'bold',
                    }}
                    title="Cruz Roja"
                  >
                    ✚
                  </div>
                )}
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Home;
