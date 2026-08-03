import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { chevronBackOutline, navigateOutline, mapOutline, shareSocialOutline } from 'ionicons/icons';
import { useHistory, useParams, Link } from 'react-router-dom';
import {
  getDetallePlaya,
  getFeaturedBeaches,
  getPlayas,
  ErrorDetalle,
  FeaturedBeach,
  SubPuntuaciones,
  PlayaDetalle as PlayaDetalleData,
} from '../services/api';
import { rutaPlaya, encontrarPorSlugs } from '../shared/seo/beachUrls';
import SeoHead, { urlCanonica } from '../shared/seo/SeoHead';
import BottomNavBar from '../shared/ui/BottomNavBar';
import SelectorIdioma from '../shared/ui/SelectorIdioma';
import './PlayaDetalle.css';
import { useIdioma } from '../shared/i18n/IdiomaContext';
import { isToday } from './playa-detalle/dates';
import FlagBanner from './playa-detalle/FlagBanner';
import ScoreCard from './playa-detalle/ScoreCard';
import DaySelector from './playa-detalle/DaySelector';
import ForecastHero from './playa-detalle/ForecastHero';
import HalfDayDetail from './playa-detalle/HalfDayDetail';
import DailyStats from './playa-detalle/DailyStats';
import TidesSection from './playa-detalle/TidesSection';
import ProximasHoras from './playa-detalle/ProximasHoras';
import ClimaHero from './playa-detalle/ClimaHero';
import MetadataFooter from './playa-detalle/MetadataFooter';
import CruzRojaCard from './playa-detalle/CruzRojaCard';
import { BeachInfoSection, BeachAttributesSection } from './playa-detalle/BeachInfoSection';
import { WebcamCard } from './playa-detalle/WebcamCard';
import { ComputedAt } from '../features/provenance/SourceAndFreshness';
import InfoDatos from '../features/provenance/InfoDatos';
import { rutaMunicipio } from '../shared/seo/landings';
import { FavoriteButton } from '../modules/favorites';

const PlayaDetallePage: React.FC = () => {
  // Two routes land here: canonical /playas/:municipio/:playa and legacy
  // /playas/:codigo. The canonical one is resolved to a codigo against the
  // catalog (getPlayas never rejects: backend, saved copy or bundled JSON).
  const { codigo, municipio, playa } = useParams<{
    codigo?: string;
    municipio?: string;
    playa?: string;
  }>();
  const [codigoResuelto, setCodigoResuelto] = useState<string | null>(codigo ?? null);
  const history = useHistory();
  const { t } = useIdioma();
  // Loaded detail TAGGED with the route it belongs to. `datos` derives from
  // it: the instant the route identity changes, the previous beach vanishes
  // SYNCHRONOUSLY — no frame where the old beach (or its canonical URL and
  // star) shows under the new route while effects catch up.
  const identidadRuta = codigo ?? `${municipio ?? ''}/${playa ?? ''}`;
  const [cargado, setCargado] = useState<{ ruta: string; detalle: PlayaDetalleData } | null>(null);
  const datos = cargado && cargado.ruta === identidadRuta ? cargado.detalle : null;
  const [error, setError] = useState(false);
  /** Estado HTTP del fallo; null = la petición no volvió (red, CORS, SW). */
  const [statusError, setStatusError] = useState<number | null>(null);
  // Ranking score (featured endpoint). Requested IN PARALLEL and optional:
  // the detail is painted without waiting for it, and if it fails/is slow it is simply not shown.
  const [puntuada, setPuntuada] = useState<FeaturedBeach | null>(null);
  // Scale of each factor, sent once per response: it travels so the bars of the
  // breakdown cannot drift from the weights the backend actually applies.
  const [maximos, setMaximos] = useState<SubPuntuaciones | null>(null);

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
    setCargado(null);
    setPuntuada(null);
    setMaximos(null);
    setSelectedDay(0);
    setError(false);
    setStatusError(null);
    if (codigo) {
      setCodigoResuelto(codigo);
      return;
    }
    let activo = true;
    setCodigoResuelto(null);
    getPlayas().then((todas) => {
      if (!activo) return;
      const encontrada = encontrarPorSlugs(todas, municipio ?? '', playa ?? '');
      if (encontrada) {
        setCodigoResuelto(encontrada.codigo);
      } else {
        // Same shape as a backend 404: unknown beach.
        setError(true);
        setStatusError(404);
      }
    });
    return () => { activo = false; };
  }, [codigo, municipio, playa]);

  useEffect(() => {
    if (!codigoResuelto) return;
    let activo = true;
    setError(false);
    setStatusError(null);
    getDetallePlaya(codigoResuelto)
      .then((detalle) => {
        if (!activo) return;
        setCargado({ ruta: identidadRuta, detalle });
        setError(false);
      })
      .catch((e) => {
        if (!activo) return;
        setError(true);
        setStatusError(e instanceof ErrorDetalle ? e.status : null);
      });
    return () => { activo = false; };
  }, [codigoResuelto]);

  useEffect(() => {
    if (!codigoResuelto) return;
    let activo = true;
    getFeaturedBeaches()
      .then((res) => {
        if (!activo) return;
        setPuntuada(res.resumenTodas.find((b) => b.codigo === codigoResuelto) ?? null);
        setMaximos(res.maximos ?? null);
      })
      .catch(() => { /* non-blocking: no score */ });
    return () => { activo = false; };
  }, [codigoResuelto]);

  const [selectedDay, setSelectedDay] = useState(0);
  // Share: native sheet when the platform has one; otherwise copy the
  // canonical URL and say so for a moment. Never a third-party SDK.
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const compartir = async (playaActual: PlayaDetalleData) => {
    const url = urlCanonica(rutaPlaya(playaActual));
    try {
      if (navigator.share) {
        await navigator.share({ title: t('seo.tituloDetalle', { nombre: playaActual.nombre }), url });
      } else {
        await navigator.clipboard.writeText(url);
        setEnlaceCopiado(true);
        setTimeout(() => setEnlaceCopiado(false), 2000);
      }
    } catch {
      // The user dismissed the share sheet (or clipboard was denied):
      // nothing to report.
    }
  };
  const pred = datos?.prediccionCompleta;
  const safeDayIndex = pred ? Math.min(selectedDay, pred.dias.length - 1) : 0;

  return (
    <IonPage className="playa-detalle-page">
      {/* Whether reached by slug or by legacy code, the canonical URL is
          always the slug one: that is what "resolves" old links for SEO
          without remounting the Ionic view stack with a client redirect. */}
      {datos && (
        <SeoHead
          titulo={t('seo.tituloDetalle', { nombre: datos.nombre })}
          descripcion={t('seo.descDetalle', { nombre: datos.nombre, municipio: datos.municipio })}
          rutaCanonica={rutaPlaya(datos)}
        />
      )}
      {/* Unknown beach: noindex and no inherited canonical — this URL must
          not present itself to crawlers as some other page. */}
      {error && !datos && statusError === 404 && (
        <SeoHead
          titulo={t('seo.tituloNoEncontrada')}
          descripcion={t('seo.descNoEncontrada')}
          rutaCanonica=""
          noindex
        />
      )}
      <div className="pd-sticky-header">
        <button className="pd-back-btn" onClick={() => history.goBack()} aria-label={t('detalle.volver')}>
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
        <div>
          <h1 className="pd-sticky-title">{datos?.nombre || t('detalle.titulo')}</h1>
          <p className="pd-sticky-subtitle">{datos?.municipio || ''}</p>
        </div>
        {datos && <FavoriteButton codigo={datos.codigo} nombre={datos.nombre} />}
        <SelectorIdioma />
      </div>

      <IonContent>
        {/* Nunca junto a los datos: un cartel de "no se pudo cargar" encima de
            una ficha cargada es, simplemente, falso. */}
        {error && !datos && (
          <div className="error-container">
            <p style={{ margin: 0 }}>{t('detalle.errorCarga')}</p>
            {/* La causa, que es lo primero que hace falta: el estado HTTP no
                necesita traducción y el fallo de red sí. */}
            <p className="error-causa">
              {statusError != null ? `HTTP ${statusError}` : t('detalle.sinRespuesta')}
            </p>
          </div>
        )}

        {!datos && !error && (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <span className="loading-text">{t('detalle.cargando')}</span>
          </div>
        )}

        {datos && (
          <>
            {/* HERO SECTION */}
            <div className="hero-section">
              {datos.lat != null && datos.lon != null && (
                <div className="hero-links">
                  <a
                    className="hero-directions-link"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${datos.lat},${datos.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IonIcon icon={navigateOutline} aria-hidden="true" /> {t('detalle.comoLlegar')}
                  </a>
                  <button
                    className="hero-directions-link"
                    onClick={() => history.push(`/mapa?lat=${datos.lat}&lon=${datos.lon}&codigo=${datos.codigo}`)}
                  >
                    <IonIcon icon={mapOutline} aria-hidden="true" /> {t('detalle.verEnMapa')}
                  </button>
                  <button
                    className="hero-directions-link"
                    onClick={() => compartir(datos)}
                    aria-live="polite"
                  >
                    <IonIcon icon={shareSocialOutline} aria-hidden="true" />{' '}
                    {enlaceCopiado ? t('detalle.enlaceCopiado') : t('detalle.compartir')}
                  </button>
                </div>
              )}

              <FlagBanner cruzRoja={datos.cruzRoja} playa={datos} />

              {puntuada && <ScoreCard puntuada={puntuada} maximos={maximos} />}
            </div>

            {/* DETAIL CONTENT */}
            <div className="detail-content">
              <div className="detail-col detail-col--forecast">
              {pred && pred.dias.length > 0 ? (
                <>
                  <DaySelector
                    fechas={pred.dias.map((d) => d.fecha)}
                    selectedDay={safeDayIndex}
                    onSelect={setSelectedDay}
                  />
                  <div className="detail-card prevision-panel">
                    <ForecastHero
                      dia={pred.dias[safeDayIndex]}
                      climaActual={isToday(pred.dias[safeDayIndex].fecha) ? datos.temperaturaActual : undefined}
                      tiempoActual={isToday(pred.dias[safeDayIndex].fecha) ? datos.tiempoActual : undefined}
                    />
                    <h3 className="section-kicker">{t('detalle.previsionAemet')}</h3>
                    <HalfDayDetail
                      manana={pred.dias[safeDayIndex].manana}
                      tarde={pred.dias[safeDayIndex].tarde}
                    />
                    <DailyStats dia={pred.dias[safeDayIndex]} embedded />
                  </div>
                  {/* Solo tiene sentido junto al día de hoy: la previsión
                      horaria es de las próximas horas, no del día elegido. */}
                  {safeDayIndex === 0 && (
                    <ProximasHoras
                      horas={datos.tiempoActual?.previsionHoras}
                      fuente={datos.tiempoActual?.previsionHorasFuente}
                    />
                  )}
                  {pred.mareas?.[safeDayIndex] && (
                    <TidesSection
                      marea={pred.mareas[safeDayIndex]}
                      fuenteMareas={pred.fuenteMareas}
                      isToday={safeDayIndex === 0}
                    />
                  )}
                  {/* Cierra la columna de AEMET, no la página: la atribución
                      tiene que acompañar a la información que elabora, y su
                      hora de elaboración con ella. */}
                  <MetadataFooter
                    zonaAvisos={pred.zonaAvisos}
                    elaboracion={pred.elaboracion}
                    fuente={pred.fuente}
                    fuenteObservacion={datos.tiempoActual?.fuente}
                  />
                </>
              ) : datos.clima ? (
                <>
                  <ClimaHero
                    clima={datos.clima}
                    temperaturaActual={datos.temperaturaActual}
                    tiempoActual={datos.tiempoActual}
                  />
                  {/* La previsión horaria es de Open-Meteo, así que las playas
                      sin ficha de AEMET también la tienen. */}
                  <ProximasHoras
                    horas={datos.tiempoActual?.previsionHoras}
                    fuente={datos.tiempoActual?.previsionHorasFuente}
                  />
                </>
              ) : null}
              </div>

              <div className="detail-col detail-col--info">
              {datos.cruzRoja != null && <CruzRojaCard cruzRoja={datos.cruzRoja} playa={datos} />}

              <WebcamCard webcam={datos.webcam} />

              <BeachInfoSection datos={datos} />
              {datos.atributos && (
                <BeachAttributesSection
                  atributos={{ ...datos.atributos, ...(datos.submarinismo ? { submarinismo: true } : {}) }}
                />
              )}

              {/* Sibling beaches: the canonical municipality page. */}
              <div className="pd-otras-playas">
                <Link className="ld-enlace" to={rutaMunicipio(datos.municipio)}>
                  {t('detalle.otrasPlayasMunicipio', { municipio: datos.municipio })} &#8250;
                </Link>
              </div>
              </div>

              {/* Lo que es de la ficha entera y no de un bloque: cuándo se
                  calculó de verdad (el backend responde desde una caché
                  stale-while-revalidate, así que "acabo de abrir la página" no
                  dice nada de la edad de los números) y que acreditar a estas
                  fuentes no es decir que colaboren. */}
              <InfoDatos etiqueta="info.sobreDatos" aria="info.aria.ficha" className="pd-info-ficha">
                <ComputedAt generadoEn={datos.generadoEn} />
                <p className="procedencia-estatica">{t('atribucion.independiente')}</p>
              </InfoDatos>
            </div>
          </>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default PlayaDetallePage;
