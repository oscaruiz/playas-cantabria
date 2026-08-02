import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import { useIdioma } from '../../i18n/IdiomaContext';
import { ClaveTexto } from '../../i18n/es';
import SeoHead from '../../seo/SeoHead';
import { LANDINGS } from '../../seo/landings';
import BottomNavBar from '../../components/BottomNavBar';
import SelectorIdioma from '../../components/SelectorIdioma';
import FilaPlaya from './FilaPlaya';
import { useCatalogo } from './useCatalogo';
import './landings.css';

export type LandingId =
  | 'playas-con-webcam'
  | 'playas-accesibles'
  | 'playas-con-socorrista'
  | 'playas-para-surf';

/**
 * One curated landing page: heading, short factual intro, ONLY the beaches
 * the shared selector accepts (src/seo/landings.js — the same module the
 * prerender uses), each linking to its canonical page. The intro carries
 * the data-source clarification; nothing here claims live conditions from
 * static attributes.
 */
const LandingPlayas: React.FC<{ id: LandingId }> = ({ id }) => {
  const { t, tPlural } = useIdioma();
  const { playas, condiciones } = useCatalogo();
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
        titulo={t(`landing.${id}.titulo` as ClaveTexto)}
        descripcion={t(`landing.${id}.intro` as ClaveTexto)}
        rutaCanonica={`/${id}`}
      />
      <div className="home-sticky-header">
        <h1 className="home-sticky-title">{t(`landing.${id}.titulo` as ClaveTexto)}</h1>
        <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        <SelectorIdioma />
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
            <div className="beach-count">{tPlural('lista.contador', lista.length)}</div>
            <div className="ld-lista">
              {lista.map((p) => (
                <FilaPlaya key={p.codigo} playa={p} condiciones={condiciones.get(p.codigo) ?? null} />
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
