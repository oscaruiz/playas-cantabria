import React, { useEffect, useMemo, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { chevronBackOutline, navigateOutline, mapOutline } from 'ionicons/icons';
import { useHistory, useParams, Link } from 'react-router-dom';
import {
  getBeachDetail,
  getBeaches,
  storeBeachDetail,
  DetailError,
  BeachDetail,
} from '../services/api';
import { beachPath, findBySlugs } from '../shared/seo/beachUrls';
import SeoHead, { canonicalUrl } from '../shared/seo/SeoHead';
import BottomNavBar from '../shared/ui/BottomNavBar';
import HeaderActions from '../shared/ui/HeaderActions';
import { ShareButton } from '../modules/share';
import './BeachDetailPage.css';
import { useLanguage } from '../shared/i18n/LanguageContext';
import { isToday } from './beach-detail/dates';
import FlagBanner from './beach-detail/FlagBanner';
import ScoreCard from './beach-detail/ScoreCard';
import DaySelector from './beach-detail/DaySelector';
import ForecastHero from './beach-detail/ForecastHero';
import HalfDayDetail from './beach-detail/HalfDayDetail';
import DailyStats from './beach-detail/DailyStats';
import TidesSection from './beach-detail/TidesSection';
import NextHours from './beach-detail/NextHours';
import WeatherHero from './beach-detail/WeatherHero';
import MetadataFooter from './beach-detail/MetadataFooter';
import RedCrossCard from './beach-detail/RedCrossCard';
import { BeachInfoSection, BeachAttributesSection } from './beach-detail/BeachInfoSection';
import { WebcamCard } from './beach-detail/WebcamCard';
import { BlueFlagBadge } from './beach-detail/BlueFlagBadge';
import { ComputedAt } from '../features/provenance/SourceAndFreshness';
import { useServiceWorkerRefresh } from '../hooks/useServiceWorkerRefresh';
import { useRanking } from '../features/ranking/useRanking';
import DataInfo from '../features/provenance/DataInfo';
import { municipalityPath } from '../shared/seo/landings';
import { FavoriteButton } from '../modules/favorites';

/** One request, one state: data and error can no longer be on screen together. */
type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; detail: BeachDetail }
  /** `httpStatus` null = the request never came back (network, CORS, SW). */
  | { status: 'error'; httpStatus: number | null };

const LOADING: DetailState = { status: 'loading' };

const BeachDetailPage: React.FC = () => {
  // Two routes land here: canonical /playas/:municipio/:playa and legacy
  // /playas/:codigo. The canonical one is resolved to a codigo against the
  // catalog (getBeaches never rejects: backend, saved copy or bundled JSON).
  const { codigo: code, municipio: municipality, playa: beach } = useParams<{
    codigo?: string;
    municipio?: string;
    playa?: string;
  }>();
  const [resolvedCode, setResolvedCode] = useState<string | null>(code ?? null);
  const history = useHistory();
  const { t } = useLanguage();
  // Detail state TAGGED with the route it belongs to. `current` derives from
  // it: the instant the route identity changes, the previous beach vanishes
  // SYNCHRONOUSLY — no frame where the old beach (or its canonical URL and
  // star) shows under the new route while effects catch up.
  //
  // One discriminated state instead of data + error flags: separate flags let
  // a transient failure leave the "no se pudo cargar" banner painted on top of
  // data a second attempt did bring. The `active` guards below keep the result
  // of a request nobody cares about any more out of the state.
  const routeIdentity = code ?? `${municipality ?? ''}/${beach ?? ''}`;
  const [state, setState] = useState<{ route: string; value: DetailState } | null>(null);
  const current = state && state.route === routeIdentity ? state.value : LOADING;
  const data = current.status === 'ready' ? current.detail : null;

  // Canonical route: slugs → codigo. The legacy route resolves synchronously.
  // On EVERY route identity change the beach-specific state is cleared first:
  // Ionic reuses the mounted view when only the params change, and without
  // this reset the previous beach would stay on screen (with its canonical
  // URL and favorite star) while — or even after — the new one fails to load.
  useEffect(() => {
    setState(null);
    setSelectedDay(0);
    if (code) {
      setResolvedCode(code);
      return;
    }
    let active = true;
    setResolvedCode(null);
    getBeaches().then((all) => {
      if (!active) return;
      const found = findBySlugs(all, municipality ?? '', beach ?? '');
      if (found) {
        setResolvedCode(found.codigo);
      } else {
        // Same shape as a backend 404: unknown beach.
        setState({ route: routeIdentity, value: { status: 'error', httpStatus: 404 } });
      }
    });
    return () => { active = false; };
  }, [code, municipality, beach]);

  useEffect(() => {
    if (!resolvedCode) return;
    let active = true;
    getBeachDetail(resolvedCode)
      .then((detail) => {
        if (!active) return;
        setState({ route: routeIdentity, value: { status: 'ready', detail } });
      })
      .catch((e) => {
        if (!active) return;
        const httpStatus = e instanceof DetailError ? e.status : null;
        setState({ route: routeIdentity, value: { status: 'error', httpStatus } });
      });
    return () => { active = false; };
  }, [resolvedCode]);

  // `ComputedAt` already says that what is painted is old, but saying it is not
  // fixing it: when the service worker delivers the response that arrived late,
  // it gets painted. The message body is used, never a new request — that would
  // feed the cache back and fire the message again.
  useServiceWorkerRefresh(({ url, datos: data }) => {
    if (!resolvedCode) return;
    if (url.endsWith(`/beaches/${resolvedCode}/details`)) {
      const detail = data as BeachDetail;
      storeBeachDetail(resolvedCode, detail);
      setState({ route: routeIdentity, value: { status: 'ready', detail } });
    }
  });

  // The score card is built from the ranking, not from the detail, so it reads
  // the ranking in force: otherwise it kept the score of the sky the service
  // worker had cached while the headline right above it showed the current one.
  const { ranking } = useRanking();
  // Ranking score (featured endpoint). Optional and derived, never stored: the
  // detail is painted without waiting for it, and a route change cannot leave
  // the previous beach's score on screen because there is nothing to clear.
  const scored = useMemo(
    () =>
      resolvedCode
        ? ranking?.resumenTodas.find((b) => b.codigo === resolvedCode) ?? null
        : null,
    [ranking, resolvedCode],
  );
  // Scale of each factor, sent once per response: it travels so the bars of the
  // breakdown cannot drift from the weights the backend actually applies.
  const maxima = ranking?.maximos ?? null;

  const [selectedDay, setSelectedDay] = useState(0);
  const pred = data?.prediccionCompleta;
  const safeDayIndex = pred ? Math.min(selectedDay, pred.dias.length - 1) : 0;
  // TODAY, not the tab that happens to be open: the shared card is always
  // today's reading, and it must not change because someone tapped "Tomorrow"
  // before sharing. Same precedence as `ForecastHero` — afternoon, then morning.
  // The tide table is indexed by the SAME position as the day, so the index is
  // what travels, not the day: `mareas[i]` belongs to `dias[i]`.
  const todayIndex = pred ? Math.max(0, pred.dias.findIndex((d) => isToday(d.fecha))) : -1;
  const todaysDay = todayIndex >= 0 ? pred?.dias[todayIndex] : undefined;

  return (
    <IonPage className="beach-detail-page">
      {/* Whether reached by slug or by legacy code, the canonical URL is
          always the slug one: that is what "resolves" old links for SEO
          without remounting the Ionic view stack with a client redirect. */}
      {data && (
        <SeoHead
          title={t('seo.tituloDetalle', { nombre: data.nombre })}
          description={t('seo.descDetalle', { nombre: data.nombre, municipio: data.municipio })}
          canonicalPath={beachPath(data)}
        />
      )}
      {/* Unknown beach: noindex and no inherited canonical — this URL must
          not present itself to crawlers as some other page. */}
      {current.status === 'error' && current.httpStatus === 404 && (
        <SeoHead
          title={t('seo.tituloNoEncontrada')}
          description={t('seo.descNoEncontrada')}
          canonicalPath=""
          noindex
        />
      )}
      <div className="pd-sticky-header">
        <button className="pd-back-btn" onClick={() => history.goBack()} aria-label={t('detalle.volver')}>
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
        <div>
          <h1 className="pd-sticky-title">{data?.nombre || t('detalle.titulo')}</h1>
          <p className="pd-sticky-subtitle">{data?.municipio || ''}</p>
        </div>
        {data && <FavoriteButton code={data.codigo} name={data.nombre} />}
        <HeaderActions />
      </div>

      <IonContent>
        {/* Never alongside the data: a "no se pudo cargar" banner on top of
            a loaded page is simply false. */}
        {current.status === 'error' && (
          <div className="error-container">
            <p style={{ margin: 0 }}>{t('detalle.errorCarga')}</p>
            {/* The cause, which is the first thing needed: the HTTP status needs
                no translation and the network failure does. */}
            <p className="error-cause">
              {current.httpStatus != null ? `HTTP ${current.httpStatus}` : t('detalle.sinRespuesta')}
            </p>
          </div>
        )}

        {current.status === 'loading' && (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <span className="loading-text">{t('detalle.cargando')}</span>
          </div>
        )}

        {data && (
          <>
            {/* HERO SECTION */}
            <div className="hero-section">
              {data.lat != null && data.lon != null && (
                <div className="hero-links">
                  <a
                    className="hero-directions-link"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IonIcon icon={navigateOutline} aria-hidden="true" /> {t('detalle.comoLlegar')}
                  </a>
                  <button
                    className="hero-directions-link"
                    onClick={() => history.push(`/mapa?lat=${data.lat}&lon=${data.lon}&codigo=${data.codigo}`)}
                  >
                    <IonIcon icon={mapOutline} aria-hidden="true" /> {t('detalle.verEnMapa')}
                  </button>
                  {/* A single share: it sends the day's card WITH the link
                      in the footer, and degrades on its own (bare link, link
                      to the clipboard) according to what the device supports.

                      `prevision` follows the same cascade the page paints: the
                      AEMET sheet when there is one and, when not, the day from
                      `clima` that `WeatherHero` builds the panel with. Without
                      that second leg, a beach without a sheet shared "Sin dato"
                      while its own page said "Tranquilo" two fingers
                      below. */}
                  <ShareButton
                    beach={data}
                    scored={scored}
                    url={canonicalUrl(beachPath(data))}
                    forecast={{
                      wind:
                        todaysDay?.tarde.viento ??
                        todaysDay?.manana.viento ??
                        data.clima?.hoy?.wind,
                      waves:
                        todaysDay?.tarde.oleaje ??
                        todaysDay?.manana.oleaje ??
                        data.clima?.hoy?.waves,
                    }}
                    hours={data.tiempoActual?.previsionHoras}
                    tides={todayIndex >= 0 ? pred?.mareas?.[todayIndex] : undefined}
                    tidePort={pred?.fuenteMareas}
                  />
                </div>
              )}

              <FlagBanner redCross={data.cruzRoja} beach={data} />

              {scored && <ScoreCard scored={scored} maxima={maxima} />}
            </div>

            {/* DETAIL CONTENT */}
            <div className="detail-content">
              <div className="detail-col detail-col--forecast">
              {pred && pred.dias.length > 0 ? (
                <>
                  <DaySelector
                    dates={pred.dias.map((d) => d.fecha)}
                    selectedDay={safeDayIndex}
                    onSelect={setSelectedDay}
                  />
                  <div className="detail-card forecast-panel">
                    <ForecastHero
                      day={pred.dias[safeDayIndex]}
                      currentWeather={isToday(pred.dias[safeDayIndex].fecha) ? data.temperaturaActual : undefined}
                      currentConditions={isToday(pred.dias[safeDayIndex].fecha) ? data.tiempoActual : undefined}
                    />
                    <h3 className="section-kicker">{t('detalle.previsionAemet')}</h3>
                    <HalfDayDetail
                      morning={pred.dias[safeDayIndex].manana}
                      afternoon={pred.dias[safeDayIndex].tarde}
                    />
                    <DailyStats day={pred.dias[safeDayIndex]} embedded />
                  </div>
                  {/* Only makes sense alongside today: the hourly forecast
                      covers the next hours, not the chosen day. */}
                  {safeDayIndex === 0 && (
                    <NextHours
                      hours={data.tiempoActual?.previsionHoras}
                      source={data.tiempoActual?.previsionHorasFuente}
                      timeWindow={data.tiempoActual?.ventanaDia}
                    />
                  )}
                  {pred.mareas?.[safeDayIndex] && (
                    <TidesSection
                      tide={pred.mareas[safeDayIndex]}
                      tideSource={pred.fuenteMareas}
                      isToday={safeDayIndex === 0}
                    />
                  )}
                  {/* It closes the AEMET column, not the page: the attribution
                      has to accompany the information it covers, and its
                      issue time with it. */}
                  <MetadataFooter
                    warningZone={pred.zonaAvisos}
                    issued={pred.elaboracion}
                    source={pred.fuente}
                    observationSource={data.tiempoActual?.fuente}
                  />
                </>
              ) : data.clima ? (
                <>
                  <WeatherHero
                    weather={data.clima}
                    currentTemperature={data.temperaturaActual}
                    currentConditions={data.tiempoActual}
                  />
                  {/* The hourly forecast comes from Open-Meteo, so beaches
                      without an AEMET sheet have it too. */}
                  <NextHours
                    hours={data.tiempoActual?.previsionHoras}
                    source={data.tiempoActual?.previsionHorasFuente}
                    timeWindow={data.tiempoActual?.ventanaDia}
                  />
                  {/* Nor do they have their own tide table: the one from the
                      nearest beach with an AEMET sheet is lent (index 0 = today,
                      like prediccionCompleta.mareas). */}
                  {data.mareaReferencia?.mareas[0] && (
                    <TidesSection
                      tide={data.mareaReferencia.mareas[0]}
                      tideSource={data.mareaReferencia.fuenteMareas}
                      isToday
                      reference={{
                        playa: data.mareaReferencia.playa,
                        distanciaKm: data.mareaReferencia.distanciaKm,
                      }}
                    />
                  )}
                </>
              ) : null}
              </div>

              <div className="detail-col detail-col--info">
              <BlueFlagBadge year={data.banderaAzul} />

              {data.cruzRoja != null && <RedCrossCard redCross={data.cruzRoja} beach={data} />}

              <WebcamCard webcam={data.webcam} />

              <BeachInfoSection data={data} />
              {data.atributos && (
                <BeachAttributesSection
                  attributes={{ ...data.atributos, ...(data.submarinismo ? { submarinismo: true } : {}) }}
                />
              )}

              {/* Sibling beaches: the canonical municipality page. */}
              <div className="pd-others-beaches">
                <Link className="ld-link" to={municipalityPath(data.municipio)}>
                  {t('detalle.otrasPlayasMunicipio', { municipio: data.municipio })} &#8250;
                </Link>
              </div>
              </div>

              {/* What belongs to the whole page and not to one block: when it
                  was really computed (the backend answers from a
                  stale-while-revalidate cache, so "I just opened the page" says
                  nothing about the age of the numbers) and that crediting these
                  sources does not mean they collaborate. */}
              <DataInfo label="info.sobreDatos" aria="info.aria.ficha" className="pd-info-ficha">
                <ComputedAt generatedAt={data.generadoEn} />
                <p className="provenance-static">{t('atribucion.independiente')}</p>
              </DataInfo>
            </div>
          </>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default BeachDetailPage;
