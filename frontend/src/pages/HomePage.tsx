import React, { useEffect, useState, useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  Playa,
  FeaturedBeach,
  FeaturedBeachesResponse,
  getPlayas,
  getFeaturedBeaches,
} from '../services/api';
import { emojiCielo, flagColorClass, getActiveAttrs } from '../utils/beachHelpers';
import { useUserLocation } from '../hooks/useUserLocation';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import { useIdioma, TraducirFn } from '../i18n/IdiomaContext';
import { traducirTextoApi } from '../i18n/apiText';
import './HomePage.css';

// ---- Helpers ----

function formatTimeAgo(timestamp: number, t: TraducirFn): string {
  const diff = Math.floor((Date.now() - timestamp) / 60000);
  if (diff < 1) return t('tiempo.ahoraMismo');
  if (diff < 60) return t('tiempo.haceMin', { n: diff });
  return t('tiempo.haceHoras', { n: Math.floor(diff / 60) });
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

// ---- Sub-components ----

const NearestCard: React.FC<{
  beach: { nombre: string; municipio: string; distKm: number };
  onClick: () => void;
}> = ({ beach, onClick }) => {
  const { t } = useIdioma();
  return (
    <div
      className="hp-nearest-card"
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={t('comun.verDetalleDe', { nombre: beach.nombre })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <span className="hp-nearest-icon" aria-hidden="true">{'\u{1F4CD}'}</span>
      <div className="hp-nearest-info">
        <p className="hp-nearest-name">{beach.nombre}</p>
        <p className="hp-nearest-sub">{beach.municipio} &middot; {t('comun.aKm', { km: Math.round(beach.distKm) })}</p>
      </div>
      <span className="hp-nearest-arrow" aria-hidden="true">&#8250;</span>
    </div>
  );
};

const HeroBody: React.FC<{
  featuredCount: number;
  avgTemp: number | null;
  totalBeaches: number;
  updatedAt: string;
}> = ({ featuredCount, avgTemp, totalBeaches, updatedAt }) => {
  const { t, tPlural } = useIdioma();
  return (
  <div className="hp-hero">
    <div className="hp-hero-badges">
      {avgTemp != null && (
        <span className="hp-badge">
          <span aria-hidden="true">{'\u{1F321}\uFE0F'}</span> {t('home.mediaTemp', { temp: avgTemp })}
        </span>
      )}
      <span className="hp-badge">
        <span aria-hidden="true">{'\u{1F3D6}'}</span> {tPlural('home.playasBadge', totalBeaches)}
      </span>
      {featuredCount > 0 && (
        <span className="hp-badge">
          <span aria-hidden="true">{'\u{1F552}'}</span> {updatedAt}
        </span>
      )}
    </div>
  </div>
  );
};

const FeaturedCard: React.FC<{
  beach: FeaturedBeach;
  distKm: number | null;
  onClick: () => void;
}> = ({ beach, distKm, onClick }) => {
  const { t, idioma } = useIdioma();
  const emoji = emojiCielo(beach.descripcionClima);
  const flagClass = beach.bandera ? flagColorClass(beach.bandera) : null;
  const attrs = getActiveAttrs(beach.atributos).slice(0, 3);
  // El regex antepone "viento" a "flojo/fuerte" — opera sobre el español
  // crudo del API, SIEMPRE antes de traducir
  const razon = beach.razonRanking.replace(/(?<!viento )\b(flojo|fuerte)\b/i, 'viento $1');

  return (
    <div
      className="hp-featured-card"
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={t('comun.verDetalleDe', { nombre: beach.nombre })}
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
            <span className={`hp-flag-dot hp-flag-${flagClass}`} aria-label={t('home.banderaAria', { bandera: traducirTextoApi(beach.bandera, idioma) })} />
          )}
          <span className="hp-featured-reason">{traducirTextoApi(razon, idioma)}</span>
          {distKm != null && (
            <span className="hp-featured-dist">{t('comun.aKm', { km: Math.round(distKm) })}</span>
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
}> = ({ beach, onClick }) => {
  const { t, idioma } = useIdioma();
  return (
    <div
      className="hp-caution-card"
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={t('comun.verDetalleDe', { nombre: beach.nombre })}
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
        <p className="hp-caution-sub">{beach.municipio} &middot; {traducirTextoApi(beach.razonRanking, idioma)}</p>
      </div>
      <span className="hp-caution-arrow" aria-hidden="true">&#8250;</span>
    </div>
  );
};

// ---- Main component ----

const HomePage: React.FC = () => {
  const [featured, setFeatured] = useState<FeaturedBeachesResponse | null>(null);
  const [allPlayas, setAllPlayas] = useState<Playa[] | null>(null);
  const [featuredError, setFeaturedError] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userLocation, locationLoading, locationDenied, locationBlocked, retryLocation } = useUserLocation();
  const history = useHistory();
  const { t, tPlural } = useIdioma();

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

    return () => { mounted = false; };
  }, []);

  const cautionBeaches = featured?.revisar ?? [];

  // Recommended: all green beaches (>= 60) from resumenTodas, sorted by proximity
  const sortedFeatured = useMemo(() => {
    if (!featured) return [];
    const pool = featured.resumenTodas.filter((b) => b.puntuacion >= 60);
    if (!userLocation) return pool.sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 5);

    const [uLat, uLon] = userLocation;
    return pool
      .sort((a, b) => {
        const diffScore = Math.abs(a.puntuacion - b.puntuacion);
        // Close in score (< 6 pts) → prioritize proximity
        if (diffScore < 6) {
          const distA = haversineKm(uLat, uLon, a.lat, a.lon);
          const distB = haversineKm(uLat, uLon, b.lat, b.lon);
          return distA - distB || a.nombre.localeCompare(b.nombre);
        }
        // Big score gap → higher score first
        return b.puntuacion - a.puntuacion;
      })
      .slice(0, 5);
  }, [featured, userLocation]);

  // Distance map for display
  const distanceMap = useMemo(() => {
    if (!userLocation || !featured) return new Map<string, number>();
    const [uLat, uLon] = userLocation;
    const map = new Map<string, number>();
    for (const b of featured.resumenTodas) {
      map.set(b.codigo, haversineKm(uLat, uLon, b.lat, b.lon));
    }
    return map;
  }, [featured, userLocation]);

  // 3 nearest beaches — uses featured data (faster than waiting for getPlayas)
  const nearestBeaches = useMemo(() => {
    if (!featured || !userLocation) return [];
    const [uLat, uLon] = userLocation;
    return [...featured.resumenTodas]
      .map((b) => ({ ...b, distKm: haversineKm(uLat, uLon, b.lat, b.lon) }))
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 3);
  }, [featured, userLocation]);

  const avgTemp = featured ? averageTemp(featured.playas) : null;
  const totalBeaches = allPlayas?.length ?? 0;
  const updatedAt = featured ? formatTimeAgo(featured.timestamp, t) : '';

  return (
    <IonPage className="hp-page">
      <div className="hp-sticky-header" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
        <h1 className="hp-sticky-title">{t('app.titulo')}</h1>
        <p className="hp-sticky-subtitle">{t('home.subtitulo')}</p>
        <SelectorIdioma />
      </div>

      <IonContent fullscreen>
        <HeroBody
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
              <span>{t('home.buscando')}</span>
            </div>
          )}

          {/* Location banner */}
          {!loading && !userLocation && locationDenied && (
            locationBlocked ? (
              <div className="hp-location-banner hp-location-banner--blocked">
                <span className="hp-location-icon" aria-hidden="true">{'\u{1F4CD}'}</span>
                <div className="hp-location-text">
                  <p className="hp-location-title">{t('home.locBloqueadaTitulo')}</p>
                  <p className="hp-location-sub">{t('home.locBloqueadaSub')}</p>
                </div>
              </div>
            ) : (
              <div
                className="hp-location-banner"
                onClick={retryLocation}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); retryLocation(); } }}
              >
                <span className="hp-location-icon" aria-hidden="true">{'\u{1F4CD}'}</span>
                <div className="hp-location-text">
                  <p className="hp-location-title">{t('home.locNoDisponibleTitulo')}</p>
                  <p className="hp-location-sub">{t('home.locNoDisponibleSub')}</p>
                </div>
              </div>
            )
          )}

          {/* Nearest beaches section */}
          {!loading && !locationDenied && (locationLoading || nearestBeaches.length > 0) && (
            <section className="hp-section">
              <h2 className="hp-section-title">
                <span aria-hidden="true">{'\u{1F4CD}'}</span> {t('home.cercaDeTi')}
              </h2>
              <div className="hp-nearest-list">
                {locationLoading ? (
                  <>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="hp-nearest-card hp-nearest-skeleton" aria-hidden="true">
                        <span className="hp-nearest-icon hp-skel-circle" />
                        <div className="hp-nearest-info">
                          <div className="hp-skel-line hp-skel-line--name" />
                          <div className="hp-skel-line hp-skel-line--sub" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  nearestBeaches.map((beach) => (
                    <NearestCard
                      key={beach.codigo}
                      beach={beach}
                      onClick={() => history.push(`/playas/${beach.codigo}`)}
                    />
                  ))
                )}
              </div>
            </section>
          )}

          {/* Featured section */}
          {!loading && !featuredError && sortedFeatured.length > 0 && (
            <section className="hp-section">
              <h2 className="hp-section-title">
                <span aria-hidden="true">{'\u{1F525}'}</span> {t('home.recomendadas')}
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
                <span aria-hidden="true">{'\u{1F525}'}</span> {t('home.recomendadas')}
              </h2>
              <div className="hp-empty-msg">
                <p>{t('home.sinDestacadas')}</p>
              </div>
            </section>
          )}

          {/* Featured error */}
          {!loading && featuredError && (
            <section className="hp-section">
              <div className="hp-error-msg">
                <p>{t('home.errorCondiciones')}</p>
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
                  {t('home.reintentar')}
                </button>
              </div>
            </section>
          )}

          {/* Caution section */}
          {!loading && cautionBeaches.length > 0 && (
            <section className="hp-section">
              <h2 className="hp-section-title">
                <span aria-hidden="true">{'\u26A0\uFE0F'}</span> {t('home.revisarAntes')}
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
                aria-label={t('home.verTodas')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push('/playas');
                  }
                }}
              >
                <span className="hp-nav-icon" aria-hidden="true">{'\u{1F4CB}'}</span>
                <div>
                  <p className="hp-nav-title">{t('home.verTodas')}</p>
                  <p className="hp-nav-sub">{tPlural('home.playasDisponibles', totalBeaches)}</p>
                </div>
              </div>
              <div
                className="hp-nav-card"
                onClick={() => history.push('/mapa')}
                role="link"
                tabIndex={0}
                aria-label={t('home.explorarMapa')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    history.push('/mapa');
                  }
                }}
              >
                <span className="hp-nav-icon" aria-hidden="true">{'\u{1F5FA}\uFE0F'}</span>
                <div>
                  <p className="hp-nav-title">{t('home.explorarMapa')}</p>
                  <p className="hp-nav-sub">{t('home.localizaCerca')}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default HomePage;
