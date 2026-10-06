import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import { ClaveTexto } from '../../shared/i18n/es';
import SeoHead from '../../shared/seo/SeoHead';
import { LANDINGS } from '../../shared/seo/landings';
import BottomNavBar from '../../shared/ui/BottomNavBar';
import HeaderActions from '../../shared/ui/HeaderActions';
import BeachCard from '../../components/BeachCard';
import { useCatalogo } from './useCatalogo';
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
const LandingPlayas: React.FC<{ id: LandingId }> = ({ id }) => {
  const { t, tPlural } = useIdioma();
  const { beaches: playas, conditions: condiciones, conditionsInstant: instanteCondiciones } = useCatalogo();
  const filtro = LANDINGS.find((l: { id: string }) => l.id === id)?.filtro as
    | ((p: unknown) => boolean)
    | undefined;

  const lista = useMemo(
    () =>
      filtro
        ? (playas ?? []).filter(filtro).sort((a, b) => a.nombre.localeCompare(b.nombre))
        : [],
    [playas, filtro]
  );

  return (
    <IonPage className="home-page">
      <SeoHead
        title={t(`landing.${id}.titulo` as ClaveTexto)}
        description={t(`landing.${id}.intro` as ClaveTexto)}
        canonicalPath={`/${id}`}
      />
      <div className="home-sticky-header">
        <div className="home-sticky-marca">
          <h1 className="home-sticky-title">{t(`landing.${id}.titulo` as ClaveTexto)}</h1>
          <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        </div>
        <HeaderActions />
      </div>
      <IonContent fullscreen>
        <div className="home-hero"><div className="home-hero-spacer" /></div>
        <p className="ld-intro">{t(`landing.${id}.intro` as ClaveTexto)}</p>
        {!playas && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
          </div>
        )}
        {playas && (
          <>
            <div className="beach-count">
              {tPlural('lista.contador', lista.length)}
              {/* The rows show conditions from the featured snapshot; say
                  how old that snapshot is (it can come from the SW cache). */}
              {condiciones.size > 0 && instanteCondiciones != null && (
                <>
                  {' · '}
                  <FreshnessLabel instant={instanteCondiciones} />
                </>
              )}
            </div>
            <div className="beach-list">
              {lista.map((p) => (
                <BeachCard key={p.codigo} beach={p} weather={condiciones.get(p.codigo)} />
              ))}
            </div>
          </>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default LandingPlayas;
