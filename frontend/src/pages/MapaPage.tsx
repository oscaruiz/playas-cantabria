import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Beach, getBeaches } from '../services/api';
import { useRanking } from '../features/ranking/useRanking';
import { useLanguage } from '../shared/i18n/IdiomaContext';
import BottomNavBar from '../shared/ui/BottomNavBar';
import HeaderActions from '../shared/ui/HeaderActions';
import BrandLogo from '../shared/ui/LogoMarca';
import SeoHead from '../shared/seo/SeoHead';
import './MapaPage.css';

// Leaflet is the heaviest dependency in the app and only this route uses
// it, so the whole canvas is code-split INSIDE the page — the only split
// IonRouterOutlet tolerates (see App.tsx). Data is fetched here so the
// requests start while the chunk downloads.
const MapCanvas = React.lazy(() => import('./mapa/MapaLienzo'));

const MapPage: React.FC = () => {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const { t } = useLanguage();

  // The markers read the ranking in force, so they repaint with every screen
  // that paints a sky — including when the answer the service worker gave up
  // on lands late.
  const { ranking } = useRanking();
  const weatherMap = useMemo(
    () => new Map((ranking?.resumenTodas ?? []).map((b) => [b.codigo, b])),
    [ranking],
  );

  useEffect(() => {
    const handleBeaches = (data: Beach[]) => {
      const valid = data
        .filter(
          (p) =>
            typeof p.lat === 'number' &&
            typeof p.lon === 'number' &&
            p.lat !== 0 &&
            p.lon !== 0
        )
        .sort((a, b) => a.lon - b.lon);
      setBeaches(valid);
    };

    getBeaches({ onBackendData: handleBeaches }).then(handleBeaches);
  }, []);

  return (
    <IonPage className="mapa-page">
      <SeoHead
        title={t('seo.tituloMapa')}
        description={t('seo.descMapa')}
        canonicalPath="/mapa"
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
          <BrandLogo />
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
          <MapCanvas beaches={beaches} weatherMap={weatherMap} />
        </Suspense>
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MapPage;
