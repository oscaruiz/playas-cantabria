import React, { useEffect, useState, useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner, IonIcon } from '@ionic/react';
import { locationOutline, warningOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import {
  Playa,
  FeaturedBeach,
  FeaturedBeachesResponse,
  getPlayas,
  getFeaturedBeaches,
} from '../services/api';
import { emojiCielo, flagColorClass, formatearHaceTiempo } from '../utils/beachHelpers';
import { haversineKm, rankearPlayas, codigoMejorPuntuacionNoHero } from '../utils/beachRanking';
import { useUserLocation } from '../hooks/useUserLocation';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import { useIdioma } from '../i18n/IdiomaContext';
import { traducirTextoApi, razonLegible, claveBandera, claveNivelVientoMs } from '../i18n/apiText';
import ScoreBadge from '../components/ScoreBadge';
import './HomePage.css';

// ---- Helpers ----

function averageTemp(playas: FeaturedBeach[]): number | null {
  const temps = playas.filter((p) => p.temperatura != null).map((p) => p.temperatura!);
  if (temps.length === 0) return null;
  return Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
}

// ---- Sub-components ----

const NearestCard: React.FC<{
  beach: FeaturedBeach & { distKm: number };
  onClick: () => void;
}> = ({ beach, onClick }) => {
  const { t, idioma } = useIdioma();
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
      <div className="hp-nearest-info">
        <p className="hp-nearest-name">{beach.nombre}</p>
        <p className="hp-nearest-sub">{beach.municipio} &middot; {t('comun.aKm', { km: Math.round(beach.distKm) })}</p>
        {beach.razonRanking && (
          <p className="hp-nearest-reason">{traducirTextoApi(razonLegible(beach.razonRanking), idioma)}</p>
        )}
      </div>
      <ScoreBadge puntuacion={beach.puntuacion} />
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
            <span aria-hidden="true">{'\uD83C\uDF21\uFE0F'}</span> {t('home.mediaTemp', { temp: avgTemp })}
          </span>
        )}
        {totalBeaches > 0 && (
          <span className="hp-badge">
            <span aria-hidden="true">{'\uD83C\uDFD6'}</span> {tPlural('home.playasBadge', totalBeaches)}
          </span>
        )}
        {featuredCount > 0 && updatedAt && (
          <span className="hp-badge">
            <span aria-hidden="true">{'\uD83D\uDD52'}</span> {updatedAt}
          </span>
        )}
      </div>
    </div>
  );
};

const HeroBeachCard: React.FC<{
  beach: FeaturedBeach;
  distKm: number | null;
  priorizadaPorCercania?: boolean;
  onVerDetalles: () => void;
  onVerEnMapa: () => void;
}> = ({ beach, distKm, priorizadaPorCercania, onVerDetalles, onVerEnMapa }) => {
  const { t, idioma } = useIdioma();
  const emoji = emojiCielo(beach.descripcionClima);
  const flagClass = beach.bandera ? flagColorClass(beach.bandera) : null;
  const razon = razonLegible(beach.razonRanking);

  return (
    <article className="hp-hero-card" aria-labelledby="hp-hero-nombre">
      <div className="hp-hero-top">
        <div className="hp-hero-clima">
          <span className="hp-hero-emoji" aria-hidden="true">{emoji}</span>
          {beach.temperatura != null && (
            <span className="hp-hero-temp">{Math.round(beach.temperatura)}{'°'}</span>
          )}
        </div>
        <div className="hp-hero-heading">
          <p id="hp-hero-nombre" className="hp-hero-name">{beach.nombre}</p>
          <p className="hp-hero-municipio">{beach.municipio}</p>
        </div>
        <div className="hp-hero-score" aria-label={t('home.puntuacionAria', { n: beach.puntuacion })}>
          <span className="hp-hero-score-num" aria-hidden="true">{beach.puntuacion}</span>
          <span className="hp-hero-score-max" aria-hidden="true">/100</span>
        </div>
      </div>

      <p className="hp-hero-reason">{traducirTextoApi(razon, idioma)}</p>

      {priorizadaPorCercania && (
        <p className="hp-hero-caveat hp-hero-caveat--info">
          <IonIcon icon={locationOutline} aria-hidden="true" /> {t('home.notaCercania')}
        </p>
      )}

      {beach.motivoBaja && (
        <p className="hp-hero-caveat">
          <IonIcon icon={warningOutline} aria-hidden="true" /> {traducirTextoApi(beach.motivoBaja, idioma)}
        </p>
      )}

      <div className="hp-hero-meta">
        {flagClass && flagClass !== 'unknown' && (
          <span className="hp-hero-meta-item">
            <span className={`hp-flag-dot hp-flag-${flagClass}`} aria-hidden="true" />
            {t(claveBandera(beach.bandera ?? undefined))}
          </span>
        )}
        {beach.vientoMs != null && (
          <span className="hp-hero-meta-item">{t(claveNivelVientoMs(beach.vientoMs))}</span>
        )}
        {distKm != null && (
          <span className="hp-hero-meta-item">{t('comun.aKm', { km: Math.round(distKm) })}</span>
        )}
      </div>

      <div className="hp-hero-actions">
        <button
          className="hp-hero-btn hp-hero-btn--primary"
          onClick={onVerDetalles}
          aria-label={t('comun.verDetalleDe', { nombre: beach.nombre })}
        >
          {t('home.verDetalles')}
        </button>
        <button
          className="hp-hero-btn hp-hero-btn--secondary"
          onClick={onVerEnMapa}
          aria-label={t('home.verEnMapaDe', { nombre: beach.nombre })}
        >
          {t('home.verEnMapa')}
        </button>
      </div>
    </article>
  );
};

const AlternativeRow: React.FC<{
  beach: FeaturedBeach;
  distKm: number | null;
  esMejorPuntuacion?: boolean;
  onClick: () => void;
}> = ({ beach, distKm, esMejorPuntuacion, onClick }) => {
  const { t, idioma } = useIdioma();
  const emoji = emojiCielo(beach.descripcionClima);
  const flagClass = beach.bandera ? flagColorClass(beach.bandera) : null;
  const razon = razonLegible(beach.razonRanking);

  return (
    <div
      className="hp-alt-row"
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={
        t('comun.verDetalleDe', { nombre: beach.nombre }) +
        (esMejorPuntuacion ? `. ${t('home.mejorPuntuacion')}` : '')
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="hp-alt-left">
        <span className="hp-alt-emoji" aria-hidden="true">{emoji}</span>
        {beach.temperatura != null && (
          <span className="hp-alt-temp">{Math.round(beach.temperatura)}{'°'}</span>
        )}
      </div>
      <div className="hp-alt-body">
        <p className="hp-alt-name">{beach.nombre}</p>
        <p className="hp-alt-municipio">{beach.municipio}</p>
        <div className="hp-alt-meta">
          {esMejorPuntuacion && (
            <span className="hp-alt-chip-mejor">
              <span aria-hidden="true">{'⭐'}</span> {t('home.mejorPuntuacion')}
            </span>
          )}
          {flagClass && flagClass !== 'unknown' && (
            <span className={`hp-flag-dot hp-flag-${flagClass}`} aria-label={t('home.banderaAria', { bandera: traducirTextoApi(beach.bandera, idioma) })} />
          )}
          <span className="hp-alt-reason">{traducirTextoApi(razon, idioma)}</span>
          {distKm != null && (
            <span className="hp-alt-dist">{t('comun.aKm', { km: Math.round(distKm) })}</span>
          )}
        </div>
      </div>
      <span className="hp-alt-score" aria-label={t('home.puntuacionAria', { n: beach.puntuacion })}>
        <span aria-hidden="true">{beach.puntuacion}</span>
      </span>
      <span className="hp-alt-arrow" aria-hidden="true">&#8250;</span>
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
      <div className="hp-caution-info">
        <p className="hp-caution-name">{beach.nombre}</p>
        <p className="hp-caution-sub">{beach.municipio} &middot; {traducirTextoApi(razonLegible(beach.razonRanking), idioma)}</p>
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
  const { t } = useIdioma();

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

  // Recommended: all green beaches (>= 60) from resumenTodas, ranked by
  // adjusted score (raw score minus distance penalty) when location exists
  const sortedFeatured = useMemo(() => {
    if (!featured) return [];
    const pool = featured.resumenTodas.filter((b) => b.puntuacion >= 60);
    return rankearPlayas(pool, userLocation);
  }, [featured, userLocation]);

  // Alternativa mostrada con mayor puntuación cruda que la hero (si existe):
  // activa la nota "priorizada por cercanía" y el chip "mejor puntuación"
  const codigoMejorPuntuacion = useMemo(
    () => (userLocation ? codigoMejorPuntuacionNoHero(sortedFeatured) : null),
    [sortedFeatured, userLocation]
  );

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

  // La mejor playa del ranking preside la página; el resto son alternativas
  const mejorPlaya = sortedFeatured.length > 0 ? sortedFeatured[0] : null;
  const alternativas = sortedFeatured.slice(1, 5);

  const avgTemp = featured ? averageTemp(featured.playas) : null;
  const totalBeaches = allPlayas?.length ?? 0;
  const updatedAt = featured ? formatearHaceTiempo(featured.timestamp, t) : '';

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
                <IonIcon className="hp-location-icon" icon={locationOutline} aria-hidden="true" />
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
                <IonIcon className="hp-location-icon" icon={locationOutline} aria-hidden="true" />
                <div className="hp-location-text">
                  <p className="hp-location-title">{t('home.locNoDisponibleTitulo')}</p>
                  <p className="hp-location-sub">{t('home.locNoDisponibleSub')}</p>
                </div>
              </div>
            )
          )}

          {/* Best beach + alternatives */}
          {!loading && !featuredError && mejorPlaya && (
            <div className="hp-main-grid">
              <section className="hp-section hp-section--hero">
                <h2 className="section-kicker">{t(userLocation ? 'home.mejorParaTi' : 'home.mejorHoy')}</h2>
                <HeroBeachCard
                  beach={mejorPlaya}
                  distKm={distanceMap.get(mejorPlaya.codigo) ?? null}
                  priorizadaPorCercania={codigoMejorPuntuacion != null}
                  onVerDetalles={() => history.push(`/playas/${mejorPlaya.codigo}`)}
                  onVerEnMapa={() => history.push(`/mapa?lat=${mejorPlaya.lat}&lon=${mejorPlaya.lon}&codigo=${mejorPlaya.codigo}`)}
                />
              </section>

              {alternativas.length > 0 && (
                <section className="hp-section hp-section--alts">
                  <h2 className="section-kicker">{t('home.alternativas')}</h2>
                  <div className="hp-alt-list">
                    {alternativas.map((beach) => (
                      <AlternativeRow
                        key={beach.codigo}
                        beach={beach}
                        distKm={distanceMap.get(beach.codigo) ?? null}
                        esMejorPuntuacion={beach.codigo === codigoMejorPuntuacion}
                        onClick={() => history.push(`/playas/${beach.codigo}`)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Featured empty */}
          {!loading && !featuredError && featured && !mejorPlaya && (
            <section className="hp-section">
              <h2 className="section-kicker">{t('home.mejorHoy')}</h2>
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

          {/* Nearest beaches section */}
          {!loading && !locationDenied && (locationLoading || nearestBeaches.length > 0) && (
            <section className="hp-section">
              <h2 className="section-kicker">{t('home.cercaDeTi')}</h2>
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

          {/* Caution section */}
          {!loading && cautionBeaches.length > 0 && (
            <section className="hp-section">
              <h2 className="section-kicker">{t('home.revisarAntes')}</h2>
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
        </div>

      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default HomePage;
