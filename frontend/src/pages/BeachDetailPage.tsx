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
  DetailError,
  BeachDetail as PlayaDetalleData,
} from '../../../../../Dev/playas-cantabria/frontend/src/services/api';
import { beachPath, findBySlugs } from '../../../../../Dev/playas-cantabria/frontend/src/shared/seo/beachUrls';
import SeoHead, { canonicalUrl } from '../../../../../Dev/playas-cantabria/frontend/src/shared/seo/SeoHead';
import BottomNavBar from '../../../../../Dev/playas-cantabria/frontend/src/shared/ui/BottomNavBar';
import HeaderActions from '../../../../../Dev/playas-cantabria/frontend/src/shared/ui/HeaderActions';
import { ShareButton } from '../../../../../Dev/playas-cantabria/frontend/src/modules/share';
import './BeachDetailPage.css';
import { useLanguage } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { isToday } from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/dates';
import FlagBanner from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/FlagBanner';
import ScoreCard from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/ScoreCard';
import DaySelector from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/DaySelector';
import ForecastHero from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/ForecastHero';
import HalfDayDetail from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/HalfDayDetail';
import DailyStats from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/DailyStats';
import TidesSection from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/TidesSection';
import NextHours from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/NextHours';
import WeatherHero from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/WeatherHero';
import MetadataFooter from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/MetadataFooter';
import RedCrossCard from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/RedCrossCard';
import { BeachInfoSection, BeachAttributesSection } from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/BeachInfoSection';
import { WebcamCard } from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/WebcamCard';
import { BlueFlagBadge } from '../../../../../Dev/playas-cantabria/frontend/src/pages/beach-detail/BlueFlagBadge';
import { ComputedAt } from '../../../../../Dev/playas-cantabria/frontend/src/features/provenance/SourceAndFreshness';
import { useServiceWorkerRefresh } from '../../../../../Dev/playas-cantabria/frontend/src/hooks/useServiceWorkerRefresh';
import { useRanking } from '../../../../../Dev/playas-cantabria/frontend/src/features/ranking/useRanking';
import DataInfo from '../../../../../Dev/playas-cantabria/frontend/src/features/provenance/DataInfo';
import { municipalityPath } from '../../../../../Dev/playas-cantabria/frontend/src/shared/seo/landings';
import { FavoriteButton } from '../../../../../Dev/playas-cantabria/frontend/src/modules/favorites';

const BeachDetailPage: React.FC = () => {
  // Two routes land here: canonical /playas/:municipio/:playa and legacy
  // /playas/:codigo. The canonical one is resolved to a codigo against the
  // catalog (getPlayas never rejects: backend, saved copy or bundled JSON).
  const { codigo: code, municipio: municipality, playa: beach } = useParams<{
    codigo?: string;
    municipio?: string;
    playa?: string;
  }>();
  const [resolvedCode, setResolvedCode] = useState<string | null>(code ?? null);
  const history = useHistory();
  const { t } = useLanguage();
  // Loaded detail TAGGED with the route it belongs to. `datos` derives from
  // it: the instant the route identity changes, the previous beach vanishes
  // SYNCHRONOUSLY — no frame where the old beach (or its canonical URL and
  // star) shows under the new route while effects catch up.
  const routeIdentity = code ?? `${municipality ?? ''}/${beach ?? ''}`;
  const [loaded, setLoaded] = useState<{ ruta: string; detalle: PlayaDetalleData } | null>(null);
  const data = loaded && loaded.ruta === routeIdentity ? loaded.detalle : null;
  const [error, setError] = useState(false);
  /** Estado HTTP del fallo; null = la petición no volvió (red, CORS, SW). */
  const [statusError, setStatusError] = useState<number | null>(null);

  /**
   * El error se ENCIENDE y se APAGA. Antes solo se encendía: cualquier fallo
   * pasajero —un intento que se cruza con otro, una petición que muere al
   * navegar, un 429 suelto— dejaba el aviso rojo clavado para siempre, y como
   * el segundo intento sí traía los datos, la ficha se pintaba entera CON el
   * cartel de "no se pudo cargar" encima. Con StrictMode el efecto corre dos
   * veces en desarrollo, así que pasaba a diario.
   *
   * El guardia `activo` es el mismo que ya usaba el efecto de la puntuación:
   * el resultado de una petición que ya no interesa no toca el estado.
   */
  // Canonical route: slugs → codigo. The legacy route resolves synchronously.
  // On EVERY route identity change the beach-specific state is cleared first:
  // Ionic reuses the mounted view when only the params change, and without
  // this reset the previous beach would stay on screen (with its canonical
  // URL and favorite star) while — or even after — the new one fails to load.
  useEffect(() => {
    setLoaded(null);
    setSelectedDay(0);
    setError(false);
    setStatusError(null);
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
        setError(true);
        setStatusError(404);
      }
    });
    return () => { active = false; };
  }, [code, municipality, beach]);

  useEffect(() => {
    if (!resolvedCode) return;
    let active = true;
    setError(false);
    setStatusError(null);
    getBeachDetail(resolvedCode)
      .then((detail) => {
        if (!active) return;
        setLoaded({ ruta: routeIdentity, detalle: detail });
        setError(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(true);
        setStatusError(e instanceof DetailError ? e.status : null);
      });
    return () => { active = false; };
  }, [resolvedCode]);

  // `ComputedAt` ya dice que lo pintado es viejo, pero decirlo no es arreglarlo:
  // cuando el service worker entrega la respuesta que llegó tarde, se pinta. Se
  // usa el cuerpo del mensaje, nunca una petición nueva — eso realimentaría la
  // caché y volvería a disparar el mensaje.
  useServiceWorkerRefresh(({ url, datos: data }) => {
    if (!resolvedCode) return;
    if (url.endsWith(`/beaches/${resolvedCode}/details`)) {
      setLoaded({ ruta: routeIdentity, detalle: data as PlayaDetalleData });
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
      {error && !data && statusError === 404 && (
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
        {/* Nunca junto a los datos: un cartel de "no se pudo cargar" encima de
            una ficha cargada es, simplemente, falso. */}
        {error && !data && (
          <div className="error-container">
            <p style={{ margin: 0 }}>{t('detalle.errorCarga')}</p>
            {/* La causa, que es lo primero que hace falta: el estado HTTP no
                necesita traducción y el fallo de red sí. */}
            <p className="error-cause">
              {statusError != null ? `HTTP ${statusError}` : t('detalle.sinRespuesta')}
            </p>
          </div>
        )}

        {!data && !error && (
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
                  {/* Un solo compartir: manda la tarjeta del día CON el enlace
                      en el pie, y va degradando solo (enlace suelto, enlace al
                      portapapeles) según lo que admita el aparato.

                      `prevision` sigue la misma cascada que pinta la ficha: la
                      hoja de AEMET cuando la hay y, cuando no, el día de
                      `clima` con el que `ClimaHero` arma el panel. Sin ese
                      segundo tramo, una playa sin hoja compartía "Sin dato"
                      mientras su propia ficha decía "Tranquilo" dos dedos más
                      abajo. */}
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
                  {/* Solo tiene sentido junto al día de hoy: la previsión
                      horaria es de las próximas horas, no del día elegido. */}
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
                  {/* Cierra la columna de AEMET, no la página: la atribución
                      tiene que acompañar a la información que elabora, y su
                      hora de elaboración con ella. */}
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
                  {/* La previsión horaria es de Open-Meteo, así que las playas
                      sin ficha de AEMET también la tienen. */}
                  <NextHours
                    hours={data.tiempoActual?.previsionHoras}
                    source={data.tiempoActual?.previsionHorasFuente}
                    timeWindow={data.tiempoActual?.ventanaDia}
                  />
                  {/* Tampoco tienen tabla de mareas propia: se presta la de
                      la playa con ficha AEMET más cercana (índice 0 = hoy,
                      igual que prediccionCompleta.mareas). */}
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

              {/* Lo que es de la ficha entera y no de un bloque: cuándo se
                  calculó de verdad (el backend responde desde una caché
                  stale-while-revalidate, así que "acabo de abrir la página" no
                  dice nada de la edad de los números) y que acreditar a estas
                  fuentes no es decir que colaboren. */}
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
