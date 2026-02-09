import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonFab,
  IonFabButton,
  IonIcon,
} from '@ionic/react';
import { mapOutline } from 'ionicons/icons';
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
    getPlayas({
      onBackendData: (data) => setPlayas(data),
    })
      .then(setPlayas)
      .catch((err: Error) => setError(err.message));
  }, []);

  const toggleOrden = useCallback(() => {
    setOrden((prev) => (prev === 'az' ? 'za' : 'az'));
  }, []);

  const filtradas = useMemo(() => {
    if (!playas) return [];
    const f = filtro.toLowerCase();
    const result = playas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(f) || p.municipio.toLowerCase().includes(f)
    );
    return result.sort((a, b) => {
      const comp = a.nombre.localeCompare(b.nombre);
      return orden === 'az' ? comp : -comp;
    });
  }, [playas, filtro, orden]);

  return (
    <IonPage className="home-page">
      <IonContent fullscreen>
        {/* Hero header */}
        <div className="home-hero">
          <h1 className="home-hero-title">Playas de Cantabria</h1>
          <p className="home-hero-subtitle">
            Consulta el estado de las playas antes de ir
          </p>
        </div>

        {/* Search bar */}
        <div className="search-bar-container">
          <div className="search-bar-inner">
            <span className="search-icon" aria-hidden="true">&#x1F50D;</span>
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar playa o municipio..."
              aria-label="Buscar playa o municipio"
            />
            <button
              className="sort-button"
              onClick={toggleOrden}
              title={orden === 'az' ? 'Ordenar Z-A' : 'Ordenar A-Z'}
              aria-label={orden === 'az' ? 'Ordenar Z-A' : 'Ordenar A-Z'}
            >
              {orden === 'az' ? 'AZ' : 'ZA'}
            </button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="home-error">
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Loading state */}
        {!playas && !error && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
            <span className="home-loading-text">Cargando playas...</span>
          </div>
        )}

        {/* Beach count */}
        {playas && (
          <div className="beach-count">
            {filtradas.length} {filtradas.length === 1 ? 'playa' : 'playas'}
            {filtro && ` para "${filtro}"`}
          </div>
        )}

        {/* Beach list */}
        {playas && filtradas.length > 0 && (
          <div className="beach-list">
            {filtradas.map((playa) => (
              <div
                key={playa.codigo}
                className="beach-card"
                onClick={() => history.push(`/playas/${playa.codigo}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push(`/playas/${playa.codigo}`);
                  }
                }}
              >
                <div className="beach-card-icon" aria-hidden="true">
                  {'\u{1F3D6}'}
                </div>
                <div className="beach-card-info">
                  <p className="beach-card-name">{playa.nombre}</p>
                  <p className="beach-card-municipio">{playa.municipio}</p>
                </div>
                {playa.idCruzRoja !== 0 && playa.idCruzRoja !== undefined && (
                  <div className="beach-card-badges">
                    <span className="badge-vigilada">
                      <span className="badge-vigilada-dot" />
                      Cruz Roja
                    </span>
                  </div>
                )}
                <span className="beach-card-arrow" aria-hidden="true">&#8250;</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {playas && filtradas.length === 0 && (
          <div className="home-empty">
            <div className="home-empty-icon" aria-hidden="true">{'\u{1F3D6}'}</div>
            <p className="home-empty-text">
              No se encontraron playas para &quot;{filtro}&quot;
            </p>
          </div>
        )}

        {/* Map FAB */}
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
