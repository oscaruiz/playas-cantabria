import React, { useEffect, useState, useMemo } from 'react';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  Playa,
  FeaturedBeach,
  FeaturedBeachesResponse,
  getPlayas,
  getFeaturedBeaches,
} from '../services/api';
import { emojiCielo, flagColorClass, getActiveAttrs } from '../utils/beachHelpers';
import BottomNavBar from '../components/BottomNavBar';
import './HomePage.css';

// ---- Helpers ----

function formatTimeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 60000);
  if (diff < 1) return 'ahora mismo';
  if (diff < 60) return `hace ${diff} min`;
  return `hace ${Math.floor(diff / 60)}h`;
}

function averageTemp(playas: FeaturedBeach[]): number | null {
  const temps = playas.filter((p) => p.temperatura != null).map((p) => p.temperatura!);
  if (temps.length === 0) return null;
  return Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bonus de proximidad: 0-25 pts extra (0km=+25, >=80km=+0) */
function proximityBonus(distKm: number): number {
  if (distKm >= 80) return 0;
  return Math.round(25 * (1 - distKm / 80));
}

// ---- Sub-components ----

const HeroSection: React.FC<{
  featuredCount: number;
  avgTemp: number | null;
  totalBeaches: number;
  updatedAt: string;
}> = ({ featuredCount, avgTemp, totalBeaches, updatedAt }) => (
  <div className="hp-hero">
    <div className="hp-hero-spacer" />
    <h1 className="hp-hero-title">Playas de Cantabria</h1>
    <p className="hp-hero-subtitle">
      {'Descubre las mejores playas de Cantabria'}
    </p>
    <div className="hp-hero-badges">
      {avgTemp != null && (
        <span className="hp-badge">
          <span aria-hidden="true">{'\u{1F321}\uFE0F'}</span> {avgTemp}{'°'} media
        </span>
      )}
      <span className="hp-badge">
        <span aria-hidden="true">{'\u{1F3D6}'}</span> {totalBeaches} playas
      </span>
      {featuredCount > 0 && (
        <span className="hp-badge">
          <span aria-hidden="true">{'\u{1F552}'}</span> {updatedAt}
        </span>
      )}
    </div>
  </div>
);

const FeaturedCard: React.FC<{
  beach: FeaturedBeach;
  distKm: number | null;
  onClick: () => void;
}> = ({ beach, distKm, onClick }) => {
  const emoji = emojiCielo(beach.descripcionClima);
  const flagClass = beach.bandera ? flagColorClass(beach.bandera) : null;
  const attrs = getActiveAttrs(beach.atributos).slice(0, 3);

  return (
    <div
      className="hp-featured-card"
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={`Ver detalle de ${beach.nombre}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="hp-featured-left">
        <span className="hp-featured-emoji" aria-hidden="true">{emoji}</span>
        {beach.temperatura != null && (
          <span className="hp-featured-temp">{Math.round(beach.temperatura)}{'°'}</span>
        )}
      </div>
      <div className="hp-featured-body">
        <p className="hp-featured-name">{beach.nombre}</p>
        <p className="hp-featured-municipio">{beach.municipio}</p>
        <div className="hp-featured-meta">
          {flagClass && flagClass !== 'unknown' && (
            <span className={`hp-flag-dot hp-flag-${flagClass}`} aria-label={`Bandera ${beach.bandera}`} />
          )}
          <span className="hp-featured-reason">{beach.razonRanking}</span>
          {distKm != null && (
            <span className="hp-featured-dist">{'a '}{Math.round(distKm)}{' km'}</span>
          )}
        </div>
        {attrs.length > 0 && (
          <div className="hp-featured-attrs">
            {attrs.map((a) => (
              <span key={a.key} className="hp-attr-chip" title={a.label}>
                <span aria-hidden="true">{a.emoji}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="hp-featured-arrow" aria-hidden="true">&#8250;</span>
    </div>
  );
};

const CautionCard: React.FC<{
  beach: FeaturedBeach;
  onClick: () => void;
}> = ({ beach, onClick }) => (
  <div
    className="hp-caution-card"
    onClick={onClick}
    role="link"
    tabIndex={0}
    aria-label={`Ver detalle de ${beach.nombre}`}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
  >
    <span className="hp-caution-icon" aria-hidden="true">{'\u26A0\uFE0F'}</span>
    <div className="hp-caution-info">
      <p className="hp-caution-name">{beach.nombre}</p>
      <p className="hp-caution-sub">{beach.municipio} &middot; {beach.razonRanking}</p>
    </div>
    <span className="hp-caution-arrow" aria-hidden="true">&#8250;</span>
  </div>
);

// ---- Main component ----

const HomePage: React.FC = () => {
  const [featured, setFeatured] = useState<FeaturedBeachesResponse | null>(null);
  const [allPlayas, setAllPlayas] = useState<Playa[] | null>(null);
  const [featuredError, setFeaturedError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const history = useHistory();

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      getFeaturedBeaches(),
      getPlayas({ onBackendData: (data) => { if (mounted) setAllPlayas(data); } }),
    ]).then(([featuredResult, playasResult]) => {
      if (!mounted) return;

      if (featuredResult.status === 'fulfilled') {
        setFeatured(featuredResult.value);
      } else {
        setFeaturedError(true);
      }

      if (playasResult.status === 'fulfilled') {
        setAllPlayas(playasResult.value);
      }

      setLoading(false);
    });

    // Geolocation (same pattern as MapaPage)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (mounted) setUserLocation([pos.coords.latitude, pos.coords.longitude]); },
        () => { /* permission denied or unavailable — no-op */ },
      );
    }

    return () => { mounted = false; };
  }, []);

  const cautionBeaches = featured?.revisar ?? [];

  // Re-sort featured by score + proximity bonus when user location is available
  const sortedFeatured = useMemo(() => {
    if (!featured) return [];
    if (!userLocation) return featured.playas;

    const [uLat, uLon] = userLocation;
    return [...featured.playas].sort((a, b) => {
      const distA = haversineKm(uLat, uLon, a.lat, a.lon);
      const distB = haversineKm(uLat, uLon, b.lat, b.lon);
      const scoreA = a.puntuacion + proximityBonus(distA);
      const scoreB = b.puntuacion + proximityBonus(distB);
      return scoreB - scoreA || a.nombre.localeCompare(b.nombre);
    });
  }, [featured, userLocation]);

  // Distance map for display
  const distanceMap = useMemo(() => {
    if (!userLocation || !featured) return new Map<string, number>();
    const [uLat, uLon] = userLocation;
    const map = new Map<string, number>();
    for (const b of featured.playas) {
      map.set(b.codigo, haversineKm(uLat, uLon, b.lat, b.lon));
    }
    return map;
  }, [featured, userLocation]);

  const avgTemp = featured ? averageTemp(featured.playas) : null;
  const totalBeaches = allPlayas?.length ?? 0;
  const updatedAt = featured ? formatTimeAgo(featured.timestamp) : '';

  return (
    <IonPage className="hp-page">
      <IonContent fullscreen>
        <HeroSection
          featuredCount={featured?.playas.length ?? 0}
          avgTemp={avgTemp}
          totalBeaches={totalBeaches}
          updatedAt={updatedAt}
        />

        <div className="hp-body">
          {/* Loading state */}
          {loading && (
            <div className="hp-loading">
              <IonSpinner name="crescent" />
              <span>Cargando condiciones...</span>
            </div>
          )}

          {/* Featured section */}
          {!loading && !featuredError && sortedFeatured.length > 0 && (
            <section className="hp-section">
              <h2 className="hp-section-title">
                <span aria-hidden="true">{'\u{1F525}'}</span> Mejores playas cerca
              </h2>
              <div className="hp-featured-scroll">
                {sortedFeatured.map((beach) => (
                  <FeaturedCard
                    key={beach.codigo}
                    beach={beach}
                    distKm={distanceMap.get(beach.codigo) ?? null}
                    onClick={() => history.push(`/playas/${beach.codigo}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Featured empty */}
          {!loading && !featuredError && featured && sortedFeatured.length === 0 && (
            <section className="hp-section">
              <h2 className="hp-section-title">
                <span aria-hidden="true">{'\u{1F525}'}</span> Mejores playas cerca
              </h2>
              <div className="hp-empty-msg">
                <p>Hoy no hay playas destacadas &mdash; consulta el listado completo</p>
              </div>
            </section>
          )}

          {/* Featured error */}
          {!loading && featuredError && (
            <section className="hp-section">
              <div className="hp-error-msg">
                <p>No se pudieron cargar las condiciones actuales</p>
                <button
                  className="hp-retry-btn"
                  onClick={() => {
                    setFeaturedError(false);
                    setLoading(true);
                    getFeaturedBeaches()
                      .then(setFeatured)
                      .catch(() => setFeaturedError(true))
                      .finally(() => setLoading(false));
                  }}
                >
                  Reintentar
                </button>
              </div>
            </section>
          )}

          {/* Caution section */}
          {!loading && cautionBeaches.length > 0 && (
            <section className="hp-section">
              <h2 className="hp-section-title">
                <span aria-hidden="true">{'\u26A0\uFE0F'}</span> Mejor revisar antes de ir
              </h2>
              <div className="hp-caution-list">
                {cautionBeaches.map((beach) => (
                  <CautionCard
                    key={beach.codigo}
                    beach={beach}
                    onClick={() => history.push(`/playas/${beach.codigo}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Quick navigation */}
          <section className="hp-section hp-nav-section">
            <div className="hp-nav-cards">
              <div
                className="hp-nav-card"
                onClick={() => history.push('/playas')}
                role="link"
                tabIndex={0}
                aria-label="Ver todas las playas"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push('/playas');
                  }
                }}
              >
                <span className="hp-nav-icon" aria-hidden="true">{'\u{1F4CB}'}</span>
                <div>
                  <p className="hp-nav-title">Ver todas las playas</p>
                  <p className="hp-nav-sub">{totalBeaches} playas disponibles</p>
                </div>
              </div>
              <div
                className="hp-nav-card"
                onClick={() => history.push('/mapa')}
                role="link"
                tabIndex={0}
                aria-label="Explorar en el mapa"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push('/mapa');
                  }
                }}
              >
                <span className="hp-nav-icon" aria-hidden="true">{'\u{1F5FA}\uFE0F'}</span>
                <div>
                  <p className="hp-nav-title">Explorar en el mapa</p>
                  <p className="hp-nav-sub">Localiza playas cerca de ti</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <BottomNavBar />
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
