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
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { Playa, getPlayas } from '../services/api';
import { useHistory } from 'react-router-dom';

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
        <IonToolbar>
          <IonTitle>Playas de Cantabria</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonSearchbar
          value={filtro}
          onIonInput={(e) => setFiltro(e.detail.value!)}
          placeholder="Buscar por nombre o municipio..."
        />

        <div style={{ padding: '0 1rem 1rem' }}>
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
