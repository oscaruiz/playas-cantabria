import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  Playa,
  FeaturedBeach,
  FeaturedBeachesResponse,
  getPlayas,
  getFeaturedBeaches,
} from '../services/api';
import { useFeaturedFresco } from '../hooks/useFeaturedFresco';
import { useIdioma } from '../shared/i18n/IdiomaContext';
import BottomNavBar from '../shared/ui/BottomNavBar';
import HeaderActions from '../shared/ui/HeaderActions';
import LogoMarca from '../shared/ui/LogoMarca';
import SeoHead from '../shared/seo/SeoHead';
import './MapaPage.css';

// Leaflet is the heaviest dependency in the app and only this route uses
// it, so the whole canvas is code-split INSIDE the page — the only split
// IonRouterOutlet tolerates (see App.tsx). Data is fetched here so the
// requests start while the chunk downloads.
const MapaLienzo = React.lazy(() => import('./mapa/MapaLienzo'));

const MapaPage: React.FC = () => {
  const [playas, setPlayas] = useState<Playa[]>([]);
  const [weatherMap, setWeatherMap] = useState<Map<string, FeaturedBeach>>(new Map());
  const { t } = useIdioma();

  const indexarPorCodigo = useCallback(
    (res: FeaturedBeachesResponse) =>
      setWeatherMap(new Map(res.resumenTodas.map((b) => [b.codigo, b]))),
    [],
  );

  // Same repaint the home page does: the markers were drawing the sky the
  // service worker had served from its cache while the detail of the beach
  // behind the marker showed the current one.
  useFeaturedFresco(indexarPorCodigo);

  useEffect(() => {
    const handlePlayas = (data: Playa[]) => {
      const validas = data
        .filter(
          (p) =>
            typeof p.lat === 'number' &&
            typeof p.lon === 'number' &&
            p.lat !== 0 &&
            p.lon !== 0
        )
        .sort((a, b) => a.lon - b.lon);
      setPlayas(validas);
    };

    getPlayas({ onBackendData: handlePlayas }).then(handlePlayas);

    getFeaturedBeaches()
      .then(indexarPorCodigo)
      .catch(() => { /* fallback: numbered markers */ });
  }, [indexarPorCodigo]);

  return (
    <IonPage className="mapa-page">
      <SeoHead
        titulo={t('seo.tituloMapa')}
        descripcion={t('seo.descMapa')}
        rutaCanonica="/mapa"
      />
      {/* Recargar al tocar el encabezado, pero SOLO sobre el título: cuando el
          manejador estaba en el contenedor, el clic en la ⓘ y en el selector
          de idioma burbujeaba hasta aquí y recargaba la página en vez de
          abrir el menú. `.header-actions` va en absoluto, así que envolver el
          texto no mueve nada. */}
      <div className="mapa-sticky-header">
        <div
          className="mapa-sticky-marca marca-con-logo"
          onClick={() => window.location.reload()}
          style={{ cursor: 'pointer' }}
        >
          <LogoMarca />
          <div className="marca-texto">
            <h1 className="mapa-sticky-title">{t('app.titulo')}</h1>
            <p className="mapa-sticky-subtitle">{t('mapa.subtitulo')}</p>
          </div>
        </div>
        <HeaderActions />
      </div>

      <IonContent className="mapa-content">
        <Suspense
          fallback={
            <div className="mapa-cargando">
              <IonSpinner name="crescent" />
            </div>
          }
        >
          <MapaLienzo playas={playas} weatherMap={weatherMap} />
        </Suspense>
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MapaPage;
