import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { chevronBackOutline, navigateOutline, mapOutline } from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import {
  getDetallePlaya,
  getFeaturedBeaches,
  FeaturedBeach,
  PlayaDetalle as PlayaDetalleData,
} from '../services/api';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import './PlayaDetalle.css';
import { useIdioma } from '../i18n/IdiomaContext';
import { isToday } from './playa-detalle/dates';
import FlagBanner from './playa-detalle/FlagBanner';
import ScoreCard from './playa-detalle/ScoreCard';
import DaySelector from './playa-detalle/DaySelector';
import ForecastHero from './playa-detalle/ForecastHero';
import HalfDayDetail from './playa-detalle/HalfDayDetail';
import DailyStats from './playa-detalle/DailyStats';
import TidesSection from './playa-detalle/TidesSection';
import ClimaHero from './playa-detalle/ClimaHero';
import MetadataFooter from './playa-detalle/MetadataFooter';
import CruzRojaCard from './playa-detalle/CruzRojaCard';
import { BeachInfoSection, BeachAttributesSection } from './playa-detalle/BeachInfoSection';
import { WebcamCard } from './playa-detalle/WebcamCard';

const PlayaDetallePage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const history = useHistory();
  const { t } = useIdioma();
  const [datos, setDatos] = useState<PlayaDetalleData | null>(null);
  const [error, setError] = useState(false);
  // Ranking score (featured endpoint). Requested IN PARALLEL and optional:
  // the detail is painted without waiting for it, and if it fails/is slow it is simply not shown.
  const [puntuada, setPuntuada] = useState<FeaturedBeach | null>(null);

  useEffect(() => {
    getDetallePlaya(codigo)
      .then(setDatos)
      .catch(() => setError(true));
  }, [codigo]);

  useEffect(() => {
    let activo = true;
    getFeaturedBeaches()
      .then((res) => {
        if (activo) setPuntuada(res.resumenTodas.find((b) => b.codigo === codigo) ?? null);
      })
      .catch(() => { /* non-blocking: no score */ });
    return () => { activo = false; };
  }, [codigo]);

  const [selectedDay, setSelectedDay] = useState(0);
  const pred = datos?.prediccionCompleta;
  const fuente = pred?.fuente ?? datos?.clima?.fuente ?? '';
  const safeDayIndex = pred ? Math.min(selectedDay, pred.dias.length - 1) : 0;

  return (
    <IonPage className="playa-detalle-page">
      <div className="pd-sticky-header">
        <button className="pd-back-btn" onClick={() => history.goBack()} aria-label={t('detalle.volver')}>
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
        <div>
          <h1 className="pd-sticky-title">{datos?.nombre || t('detalle.titulo')}</h1>
          <p className="pd-sticky-subtitle">{datos?.municipio || ''}</p>
        </div>
        <SelectorIdioma />
      </div>

      <IonContent>
        {error && (
          <div className="error-container">
            <p style={{ margin: 0 }}>{t('detalle.errorCarga')}</p>
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
                </div>
              )}

              <FlagBanner cruzRoja={datos.cruzRoja} playa={datos} />

              {puntuada && <ScoreCard puntuada={puntuada} />}
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
                  {pred.mareas?.[safeDayIndex] && (
                    <TidesSection
                      marea={pred.mareas[safeDayIndex]}
                      fuenteMareas={pred.fuenteMareas}
                      isToday={safeDayIndex === 0}
                    />
                  )}
                </>
              ) : datos.clima ? (
                <ClimaHero
                  clima={datos.clima}
                  temperaturaActual={datos.temperaturaActual}
                  tiempoActual={datos.tiempoActual}
                />
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
              </div>

              {pred && (
                <MetadataFooter
                  zonaAvisos={pred.zonaAvisos}
                  elaboracion={pred.elaboracion}
                />
              )}

              {fuente && (
                <p className="source-label">
                  {t('detalle.datosMeteo', { fuente: fuente.replace('AEMET_HTML', 'AEMET').replace('AEMET_XML', 'AEMET') })}
                </p>
              )}
            </div>
          </>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default PlayaDetallePage;
