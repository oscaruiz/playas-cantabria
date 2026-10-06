import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import { useLanguage } from '../../shared/i18n/LanguageContext';
import { TextKey } from '../../shared/i18n/es';
import SeoHead from '../../shared/seo/SeoHead';
import { LANDINGS } from '../../shared/seo/landings';
import BottomNavBar from '../../shared/ui/BottomNavBar';
import HeaderActions from '../../shared/ui/HeaderActions';
import BeachCard from '../../components/BeachCard';
import { useCatalog } from './useCatalog';
import { FreshnessLabel } from '../../features/provenance/SourceAndFreshness';
import './landings.css';

export type LandingId =
  | 'playas-con-webcam'
  | 'playas-accesibles'
  | 'playas-con-socorrista'
  | 'playas-para-surf';

/**
 * One curated landing page: heading, short factual intro, ONLY the beaches
 * the shared selector accepts (src/shared/seo/landings.js — the same module the
 * prerender uses), each linking to its canonical page. The intro carries
 * the data-source clarification; nothing here claims live conditions from
 * static attributes.
 */
const BeachLanding: React.FC<{ id: LandingId }> = ({ id }) => {
  const { t, tPlural } = useLanguage();
  const { beaches, conditions, conditionsInstant } = useCatalog();
  const filter = LANDINGS.find((l: { id: string }) => l.id === id)?.filtro as
    | ((p: unknown) => boolean)
    | undefined;

  const list = useMemo(
    () =>
      filter
        ? (beaches ?? []).filter(filter).sort((a, b) => a.nombre.localeCompare(b.nombre))
        : [],
    [beaches, filter]
  );

  return (
    <IonPage className="home-page">
      <SeoHead
        title={t(`landing.${id}.titulo` as TextKey)}
        description={t(`landing.${id}.intro` as TextKey)}
        canonicalPath={`/${id}`}
      />
      <div className="home-sticky-header">
        <div className="home-sticky-brand">
          <h1 className="home-sticky-title">{t(`landing.${id}.titulo` as TextKey)}</h1>
          <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        </div>
        <HeaderActions />
      </div>
      <IonContent fullscreen>
        <div className="home-hero"><div className="home-hero-spacer" /></div>
        <p className="ld-intro">{t(`landing.${id}.intro` as TextKey)}</p>
        {!beaches && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
          </div>
        )}
        {beaches && (
          <>
            <div className="beach-count">
              {tPlural('lista.contador', list.length)}
              {/* The rows show conditions from the featured snapshot; say
                  how old that snapshot is (it can come from the SW cache). */}
              {conditions.size > 0 && conditionsInstant != null && (
                <>
                  {' · '}
                  <FreshnessLabel instant={conditionsInstant} />
                </>
              )}
            </div>
            <div className="beach-list">
              {list.map((p) => (
                <BeachCard key={p.codigo} beach={p} weather={conditions.get(p.codigo)} />
              ))}
            </div>
          </>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default BeachLanding;
