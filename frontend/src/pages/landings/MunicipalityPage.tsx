import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner, IonIcon } from '@ionic/react';
import { chevronBackOutline } from 'ionicons/icons';
import { useParams, useHistory } from 'react-router-dom';
import { Beach } from '../../../../../../Dev/playas-cantabria/frontend/src/services/api';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import SeoHead from '../../../../../../Dev/playas-cantabria/frontend/src/shared/seo/SeoHead';
import { beachesOfMunicipalitySlug, municipalityPath } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/seo/landings';
import BottomNavBar from '../../../../../../Dev/playas-cantabria/frontend/src/shared/ui/BottomNavBar';
import HeaderActions from '../../../../../../Dev/playas-cantabria/frontend/src/shared/ui/HeaderActions';
import BeachCard from '../../../../../../Dev/playas-cantabria/frontend/src/components/BeachCard';
import { useCatalog } from '../../../../../../Dev/playas-cantabria/frontend/src/pages/landings/useCatalog';
import { FreshnessLabel } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/SourceAndFreshness';
import './landings.css';

/** The beaches of one municipality, each linking to its canonical page. */
const MunicipalityPage: React.FC = () => {
  const { municipio: municipality } = useParams<{ municipio: string }>();
  const history = useHistory();
  const { t, tPlural } = useLanguage();
  const { beaches, conditions, conditionsInstant } = useCatalog();

  const list = useMemo(
    () =>
      (beachesOfMunicipalitySlug(beaches ?? [], municipality) as Beach[]).sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      ),
    [beaches, municipality]
  );
  const municipalityName = list[0]?.municipio ?? null;

  return (
    <IonPage className="home-page">
      {municipalityName && (
        <SeoHead
          title={t('seo.tituloMunicipio', { municipio: municipalityName })}
          description={t('seo.descMunicipio', { municipio: municipalityName })}
          canonicalPath={municipalityPath(municipalityName)}
        />
      )}
      {beaches && !municipalityName && (
        <SeoHead
          title={t('seo.tituloNoEncontrada')}
          description={t('seo.descNoEncontrada')}
          canonicalPath=""
          noindex
        />
      )}
      <div className="home-sticky-header ld-header-back">
        <button
          className="pd-back-btn"
          onClick={() => history.goBack()}
          aria-label={t('detalle.volver')}
        >
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
        <div className="ld-header-texts">
          <p className="home-sticky-title">{municipalityName ?? t('app.titulo')}</p>
          <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        </div>
        <HeaderActions />
      </div>
      <IonContent fullscreen>
        <div className="home-hero"><div className="home-hero-spacer" /></div>
        {!beaches && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
          </div>
        )}
        {beaches && municipalityName && (
          <>
            <h1 className="ld-headline">
              {t('municipio.titulo', { municipio: municipalityName })}
            </h1>
            <p className="ld-intro">{t('municipio.intro', { municipio: municipalityName })}</p>
            <div className="beach-count">
              {tPlural('lista.contador', list.length)}
              {conditions.size > 0 && conditionsInstant != null && (
                <>
                  {' · '}
                  <FreshnessLabel instant={conditionsInstant} />
                </>
              )}
            </div>
            <div className="beach-list">
              {list.map((p: Beach) => (
                <BeachCard key={p.codigo} beach={p} weather={conditions.get(p.codigo)} />
              ))}
            </div>
          </>
        )}
        {beaches && !municipalityName && (
          <div className="home-empty">
            <p className="home-empty-text">{t('municipio.desconocido')}</p>
            <button className="ld-link" onClick={() => history.push('/playas')}>
              {t('nav.playas')}
            </button>
          </div>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MunicipalityPage;
