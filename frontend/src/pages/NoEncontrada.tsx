import React from 'react';
import { IonPage, IonContent, IonFooter } from '@ionic/react';
import { Link } from 'react-router-dom';
import { useIdioma } from '../i18n/IdiomaContext';
import SeoHead from '../seo/SeoHead';
import BottomNavBar from '../components/BottomNavBar';
import SelectorIdioma from '../components/SelectorIdioma';
import './landings/landings.css';

/**
 * Catch-all for URLs matching no route shape at all. noindex and no
 * canonical: a soft-404 must not present itself to crawlers as a page.
 */
const NoEncontrada: React.FC = () => {
  const { t } = useIdioma();
  return (
    <IonPage className="home-page">
      <SeoHead
        titulo={t('seo.tituloNoEncontrada')}
        descripcion={t('seo.descNoEncontrada')}
        rutaCanonica=""
        noindex
      />
      <div className="home-sticky-header">
        <p className="home-sticky-title">{t('app.titulo')}</p>
        <SelectorIdioma />
      </div>
      <IonContent fullscreen>
        <div className="home-hero"><div className="home-hero-spacer" /></div>
        <div className="home-empty">
          <p className="home-empty-text">{t('noEncontrada.texto')}</p>
          <Link className="ld-enlace" to="/playas">{t('nav.playas')}</Link>
        </div>
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default NoEncontrada;
