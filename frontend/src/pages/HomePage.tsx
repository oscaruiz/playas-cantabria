import React, { useEffect, useState, useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner, IonIcon } from '@ionic/react';
import { locationOutline, warningOutline } from 'ionicons/icons';
import { useHistory, Link } from 'react-router-dom';
import {
  Beach,
  FeaturedBeach,
  getBeaches,
} from '../services/api';
import { rankedSkyEmoji, flagColorClass } from '../utils/beachHelpers';
import { formatTimeAgo, madridLocalHour } from '../../../../../Dev/playas-cantabria/frontend/src/shared/format/time';
import { FreshnessLabel } from '../features/provenance/SourceAndFreshness';
import { rankBeaches, topScoreCodeNoHero } from '../utils/beachRanking';
import { haversineKm } from '../shared/geo/haversine';
import { useUserLocation } from '../hooks/useUserLocation';
import { useRanking } from '../features/ranking/useRanking';
import BottomNavBar from '../shared/ui/BottomNavBar';
import HeaderActions from '../shared/ui/HeaderActions';
import BrandLogo from '../../../../../Dev/playas-cantabria/frontend/src/shared/ui/BrandLogo';
import { useLanguage } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import {
  translateApiText,
  readableReason,
  flagKey,
  windLevelKey,
  noForecastFragment,
} from '../shared/i18n/apiText';
import ScoreBadge from '../components/ScoreBadge';
import TrendBadge from '../components/TrendBadge';
import BestTime from '../../../../../Dev/playas-cantabria/frontend/src/components/BestTime';
import type { TextKey } from '../shared/i18n/es';
import SafetyNotice from '../shared/ui/SafetyNotice';
import { beachPath } from '../shared/seo/beachUrls';
import SeoHead from '../shared/seo/SeoHead';
import { useFavoriteCodes } from '../modules/favorites';
import { InstallButton } from '../../../../../Dev/playas-cantabria/frontend/src/modules/install';
import './HomePage.css';

/**
 * The verdict as a sentence, by bands of the existing score. Client-side on
 * purpose: the mark already travels, and a phrase computed here cannot drift
 * from the number shown next to it. Below 30 there is no phrase — a beach
 * that bad does not reach the hero card.
 */
function ratingPhraseKey(score: number): TextKey | null {
  if (score >= 75) return 'home.frase.muyBien';
  if (score >= 60) return 'home.frase.bien';
  if (score >= 30) return 'home.frase.regular';
  return null;
}

/**
 * The reason as the card must read it: with the outlook fragment removed,
 * because `TrendBadge` is right underneath saying the same thing (and saying
 * it better, with the cause).
 */
function noForecastReason(beach: FeaturedBeach, text: string | null): string {
  if (!text) return '';
  return beach.pronostico ? noForecastFragment(text) : text;
}

// ---- Helpers ----

function averageTemp(beaches: FeaturedBeach[]): number | null {
  const temps = beaches.filter((p) => p.temperatura != null).map((p) => p.temperatura!);
  if (temps.length === 0) return null;
  return Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
}

// ---- Sub-components ----

const NearestCard: React.FC<{
  beach: FeaturedBeach & { distKm: number };
  onClick: () => void;
}> = ({ beach, onClick }) => {
  const { t, language } = useLanguage();
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
          <p className="hp-nearest-reason">
            {translateApiText(noForecastReason(beach, readableReason(beach.razonRanking)), language)}
          </p>
        )}
        <TrendBadge outlook={beach.pronostico} />
      </div>
      <ScoreBadge score={beach.puntuacion} />
      <span className="hp-nearest-arrow" aria-hidden="true">&#8250;</span>
    </div>
  );
};

const HeroBody: React.FC<{
  avgTemp: number | null;
  totalBeaches: number;
  /** Epoch ms of the featured snapshot; null hides the badge. */
  updatedMs: number | null;
  /** A refetch is in flight right now — said here, where the age already is. */
  updating: boolean;
}> = ({ avgTemp, totalBeaches, updatedMs, updating }) => {
  const { t, tPlural } = useLanguage();
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
        {/* When the data is from does not depend on there being recommended
            beaches: a ranking with none was assembled just as recently, and
            hanging this off `featuredCount` hid it on exactly the odd day.
            Relative AND the Madrid clock time: "3 min ago" says whether it is
            alive, the time says which reading it is — and that is the one you
            can check against your own watch. */}
        {updatedMs != null && (
          <span className="hp-badge">
            {/* The clock becomes a spinner while a refetch is really in
                flight. The app does go looking on its own — every ten minutes,
                and on the way back to the tab — and saying nothing about it
                made a screen that was working look stuck. It REPLACES the
                clock instead of sitting beside it, so the badge neither moves
                nor grows, and it hangs on a request that is running, never on
                an intention: that is the whole difference from the notice that
                promised "buscando los de ahora…" with nobody looking. What it
                does not promise is that the number will change — the backend
                may legitimately answer with the same reading it just gave. */}
            {updating ? (
              <IonSpinner
                name="crescent"
                className="hp-badge-spinner"
                aria-label={t('home.actualizando')}
              />
            ) : (
              <span aria-hidden="true">{'\uD83D\uDD52'}</span>
            )}{' '}
            <FreshnessLabel instant={updatedMs} />
            {' · '}
            {madridLocalHour(new Date(updatedMs).toISOString())}
          </span>
        )}
        {/* Renders nothing unless this browser can really install the app. */}
        <InstallButton className="hp-badge" />
      </div>
    </div>
  );
};

const HeroBeachCard: React.FC<{
  beach: FeaturedBeach;
  distKm: number | null;
  prioritizedByProximity?: boolean;
  onViewDetails: () => void;
  onViewOnMap: () => void;
}> = ({ beach, distKm, prioritizedByProximity, onViewDetails, onViewOnMap }) => {
  const { t, language } = useLanguage();
  // `iconoClima` es el icono de OpenWeather ('01d'/'01n'): trae su propia
  // decisión de día o noche, que sigue al ocaso real de esas coordenadas.
  const emoji = rankedSkyEmoji(beach);
  const flagClass = beach.bandera ? flagColorClass(beach.bandera) : null;
  const rationale = noForecastReason(beach, readableReason(beach.razonRanking));

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

      {ratingPhraseKey(beach.puntuacion) && (
        <p className="hp-hero-frase">
          {t(ratingPhraseKey(beach.puntuacion) as TextKey, { nombre: beach.nombre })}
        </p>
      )}

      <p className="hp-hero-reason">{translateApiText(rationale, language)}</p>

      {/* CUÁNDO ir, no solo si está bien: la mejor franja del resto del día. */}
      <BestTime timeWindow={beach.ventanaDia} />

      {/* Lo más accionable de la portada: si la mejor playa de hoy va a peor
          dentro de dos horas, hay que decirlo aquí y no en el detalle. */}
      <TrendBadge outlook={beach.pronostico} />

      {prioritizedByProximity && (
        <p className="hp-hero-caveat hp-hero-caveat--info">
          <IonIcon icon={locationOutline} aria-hidden="true" /> {t('home.notaCercania')}
        </p>
      )}

      {beach.motivoBaja && noForecastReason(beach, beach.motivoBaja) && (
        <p className="hp-hero-caveat">
          <IonIcon icon={warningOutline} aria-hidden="true" />{' '}
          {translateApiText(noForecastReason(beach, beach.motivoBaja), language)}
        </p>
      )}

      <div className="hp-hero-meta">
        {flagClass && flagClass !== 'unknown' && (
          <span className="hp-hero-meta-item">
            <span className={`hp-flag-dot hp-flag-${flagClass}`} aria-hidden="true" />
            {t(flagKey(beach.bandera ?? undefined))}
          </span>
        )}
        {beach.vientoMs != null && (
          <span className="hp-hero-meta-item">{t(windLevelKey(beach.vientoMs))}</span>
        )}
        {distKm != null && (
          <span className="hp-hero-meta-item">{t('comun.aKm', { km: Math.round(distKm) })}</span>
        )}
      </div>

      <div className="hp-hero-actions">
        <button
          className="hp-hero-btn hp-hero-btn--primary"
          onClick={onViewDetails}
          aria-label={t('comun.verDetalleDe', { nombre: beach.nombre })}
        >
          {t('home.verDetalles')}
        </button>
        <button
          className="hp-hero-btn hp-hero-btn--secondary"
          onClick={onViewOnMap}
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
  isTopScore?: boolean;
  onClick: () => void;
}> = ({ beach, distKm, isTopScore, onClick }) => {
  const { t, language } = useLanguage();
  // `iconoClima` es el icono de OpenWeather ('01d'/'01n'): trae su propia
  // decisión de día o noche, que sigue al ocaso real de esas coordenadas.
  const emoji = rankedSkyEmoji(beach);
  const flagClass = beach.bandera ? flagColorClass(beach.bandera) : null;
  const rationale = noForecastReason(beach, readableReason(beach.razonRanking));

  return (
    <div
      className="hp-alt-row"
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={
        t('comun.verDetalleDe', { nombre: beach.nombre }) +
        (isTopScore ? `. ${t('home.mejorPuntuacion')}` : '')
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
          {isTopScore && (
            <span className="hp-alt-chip-mejor">
              <span aria-hidden="true">{'⭐'}</span> {t('home.mejorPuntuacion')}
            </span>
          )}
          {flagClass && flagClass !== 'unknown' && (
            <span className={`hp-flag-dot hp-flag-${flagClass}`} aria-label={t('home.banderaAria', { bandera: translateApiText(beach.bandera, language) })} />
          )}
          <span className="hp-alt-reason">{translateApiText(rationale, language)}</span>
          {distKm != null && (
            <span className="hp-alt-dist">{t('comun.aKm', { km: Math.round(distKm) })}</span>
          )}
        </div>
        <TrendBadge outlook={beach.pronostico} />
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
  const { t, language } = useLanguage();
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
        <p className="hp-caution-sub">
          {beach.municipio} &middot;{' '}
          {translateApiText(noForecastReason(beach, readableReason(beach.razonRanking)), language)}
        </p>
        {/* Aquí importa el sentido contrario: una playa ya floja que además va
            a peor no es lo mismo que una que simplemente está floja. */}
        <TrendBadge outlook={beach.pronostico} />
      </div>
      <span className="hp-caution-arrow" aria-hidden="true">&#8250;</span>
    </div>
  );
};

// ---- Main component ----

const HomePage: React.FC = () => {
  const {
    ranking: featured,
    updatedMs,
    fromPreviousVisit,
    loading: featuredLoading,
    error: featuredError,
    retrying,
    retry,
  } = useRanking();
  const [allBeaches, setAllBeaches] = useState<Beach[] | null>(null);
  const { userLocation, locationLoading, locationDenied, locationBlocked, retryLocation } = useUserLocation();
  const history = useHistory();
  const { t } = useLanguage();

  useEffect(() => {
    let mounted = true;

    getBeaches({ onBackendData: (data) => { if (mounted) setAllBeaches(data); } })
      .then((data) => {
        if (mounted) setAllBeaches(data);
      });

    return () => { mounted = false; };
  }, []);

  const cautionBeaches = featured?.revisar ?? [];

  // Recommended: all green beaches (>= 60) from resumenTodas, ranked by
  // adjusted score (raw score minus distance penalty) when location exists
  const sortedFeatured = useMemo(() => {
    if (!featured) return [];
    const pool = featured.resumenTodas.filter((b) => b.puntuacion >= 60);
    return rankBeaches(pool, userLocation);
  }, [featured, userLocation]);

  // Displayed alternative with a higher raw score than the hero (if any):
  // enables the "prioritized by proximity" note and the "best score" chip
  const topScoreCode = useMemo(
    () => (userLocation ? topScoreCodeNoHero(sortedFeatured) : null),
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

  // The best-ranked beach presides over the page; the rest are alternatives
  const bestBeach = sortedFeatured.length > 0 ? sortedFeatured[0] : null;
  const alternatives = sortedFeatured.slice(1, 5);

  // Favorites go at the very top, but as THEIR OWN section: they never
  // displace "the best beach today", which must remain the honestly ranked
  // one. Conditions are joined from resumenTodas when the ranking loaded;
  // without it the row still shows name and municipality from the catalog.
  const { favorites } = useFavoriteCodes();
  const favoritesOnHome = useMemo(() => {
    if (!allBeaches || favorites.size === 0) return [];
    const byCode = new Map((featured?.resumenTodas ?? []).map((b) => [b.codigo, b]));
    return allBeaches
      .filter((p) => favorites.has(p.codigo))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => ({ playa: p, condiciones: byCode.get(p.codigo) ?? null }));
  }, [allBeaches, favorites, featured]);

  const avgTemp = featured ? averageTemp(featured.playas) : null;
  const totalBeaches = allBeaches?.length ?? 0;
  return (
    <IonPage className="hp-page">
      <SeoHead
        title={t('seo.tituloInicio')}
        description={t('seo.descInicio')}
        canonicalPath="/"
      />
      {/* Recargar al tocar el encabezado, pero SOLO sobre el título: cuando el
          manejador estaba en el contenedor, el clic en la ⓘ y en el selector
          de idioma burbujeaba hasta aquí y recargaba la página en vez de
          abrir el menú. `.header-actions` va en absoluto, así que envolver el
          texto no mueve nada. */}
      <div className="hp-sticky-header">
        <div
          className="hp-sticky-marca marca-con-logo"
          onClick={() => window.location.reload()}
          style={{ cursor: 'pointer' }}
        >
          <BrandLogo />
          <div className="marca-texto">
            <h1 className="hp-sticky-title">{t('app.titulo')}</h1>
            <p className="hp-sticky-subtitle">{t('home.subtitulo')}</p>
          </div>
        </div>
        <HeaderActions />
      </div>

      <IonContent fullscreen>
        <HeroBody
          avgTemp={avgTemp}
          totalBeaches={totalBeaches}
          updatedMs={updatedMs}
          updating={retrying}
        />

        <div className="hp-body">
          {/* What is painted is older than anything the backend can still be
              serving, so it came from the service worker's copy or the
              snapshot. It is said, rather than passing last night's sky off as
              this morning's — and said and nothing more: it was a retry button
              for a day, and the tap could not win. The backend answers a forced
              refetch from the same stale window, the worker resolves it with
              the same stored body at three seconds, and the user was left
              pressing a button that had never had anything to give. What can
              retire this is a real answer, and the app already asks for one on
              its own. */}
          {fromPreviousVisit && (
            <p className="hp-aviso-cache" role="status">
              {t('home.datosDeCache')}
              {' · '}
              {formatTimeAgo(updatedMs as number, t)}
            </p>
          )}

          {/* Favorites first — independent of the featured ranking's fate
              (they still show if it fails), but not of its timing: painted
              alone above the spinner they looked like the whole page. */}
          {!featuredLoading && favoritesOnHome.length > 0 && (
            <section className="hp-section hp-section--favoritas">
              <h2 className="section-kicker">{t('home.favoritas')}</h2>
              <div className="hp-alt-list">
                {favoritesOnHome.map(({ playa: beach, condiciones: conditions }) =>
                  conditions ? (
                    <AlternativeRow
                      key={beach.codigo}
                      beach={conditions}
                      distKm={distanceMap.get(beach.codigo) ?? null}
                      onClick={() => history.push(beachPath(beach))}
                    />
                  ) : (
                    <Link
                      key={beach.codigo}
                      to={beachPath(beach)}
                      className="hp-alt-row"
                      aria-label={t('comun.verDetalleDe', { nombre: beach.nombre })}
                    >
                      <div className="hp-alt-body">
                        <p className="hp-alt-name">{beach.nombre}</p>
                        <p className="hp-alt-municipio">{beach.municipio}</p>
                      </div>
                    </Link>
                  )
                )}
              </div>
            </section>
          )}

          {/* Loading state */}
          {featuredLoading && (
            <div className="hp-loading">
              <IonSpinner name="crescent" />
              <span>{t('home.buscando')}</span>
            </div>
          )}

          {/* Location banner */}
          {!userLocation && locationDenied && (
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
          {!featuredLoading && !featuredError && bestBeach && (
            <div className="hp-main-grid">
              <section className="hp-section hp-section--hero">
                <h2 className="section-kicker">{t(userLocation ? 'home.mejorParaTi' : 'home.mejorHoy')}</h2>
                <HeroBeachCard
                  beach={bestBeach}
                  distKm={distanceMap.get(bestBeach.codigo) ?? null}
                  prioritizedByProximity={topScoreCode != null}
                  onViewDetails={() => history.push(beachPath(bestBeach))}
                  onViewOnMap={() => history.push(`/mapa?lat=${bestBeach.lat}&lon=${bestBeach.lon}&codigo=${bestBeach.codigo}`)}
                />
                {/* Colgado de la recomendación, no en una fila propia del
                    grid: ahí abría una banda vacía de ~70 px (margen de
                    sección + gap) bajo las dos columnas. Aquí además ocupa el
                    blanco que la columna izquierda ya deja por ser la corta.
                    Sigue siendo UNO para todo el ranking: alternativas y
                    "revisar antes" salen del mismo cálculo. */}
                <SafetyNotice kind="ranking" />
              </section>

              {alternatives.length > 0 && (
                <section className="hp-section hp-section--alts">
                  <h2 className="section-kicker">{t('home.alternativas')}</h2>
                  <div className="hp-alt-list">
                    {alternatives.map((beach) => (
                      <AlternativeRow
                        key={beach.codigo}
                        beach={beach}
                        distKm={distanceMap.get(beach.codigo) ?? null}
                        isTopScore={beach.codigo === topScoreCode}
                        onClick={() => history.push(beachPath(beach))}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Featured empty */}
          {!featuredLoading && !featuredError && featured && !bestBeach && (
            <section className="hp-section">
              <h2 className="section-kicker">{t('home.mejorHoy')}</h2>
              <div className="hp-empty-msg">
                <p>{t('home.sinDestacadas')}</p>
                <button className="hp-retry-btn" onClick={() => history.push('/playas')}>
                  {t('home.sinDestacadasBoton')}
                </button>
              </div>
            </section>
          )}

          {/* Featured error */}
          {!featuredLoading && featuredError && (
            <section className="hp-section">
              <div className="hp-error-msg">
                <p>{t('home.errorCondiciones')}</p>
                {/* Waking a sleeping Render takes half a minute: a button that
                    only greys out looks like a button that did nothing. */}
                <button
                  className="hp-retry-btn"
                  onClick={retry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <>
                      <IonSpinner name="crescent" className="hp-retry-spinner" />
                      {t('home.buscando')}
                    </>
                  ) : (
                    t('home.reintentar')
                  )}
                </button>
              </div>
            </section>
          )}

          {/* Nearest beaches section */}
          {!locationDenied && (locationLoading || nearestBeaches.length > 0) && (
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
          {!featuredLoading && cautionBeaches.length > 0 && (
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
