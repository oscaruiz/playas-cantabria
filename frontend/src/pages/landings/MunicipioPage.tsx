import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner, IonIcon } from '@ionic/react';
import { chevronBackOutline } from 'ionicons/icons';
import { useParams, useHistory } from 'react-router-dom';
import { Playa } from '../../services/api';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import SeoHead from '../../shared/seo/SeoHead';
import { beachesOfMunicipalitySlug, municipalityPath } from '../../shared/seo/landings';
import BottomNavBar from '../../shared/ui/BottomNavBar';
import HeaderActions from '../../shared/ui/HeaderActions';
import BeachCard from '../../components/BeachCard';
import { useCatalogo } from './useCatalogo';
import { FreshnessLabel } from '../../features/provenance/SourceAndFreshness';
import './landings.css';

/** The beaches of one municipality, each linking to its canonical page. */
const MunicipioPage: React.FC = () => {
  const { municipio: municipio } = useParams<{ municipio: string }>();
  const history = useHistory();
  const { t, tPlural } = useIdioma();
  const { beaches: playas, conditions: condiciones, conditionsInstant: instanteCondiciones } = useCatalogo();

  const lista = useMemo(
    () =>
      (beachesOfMunicipalitySlug(playas ?? [], municipio) as Playa[]).sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      ),
    [playas, municipio]
  );
  const nombreMunicipio = lista[0]?.municipio ?? null;

  return (
    <IonPage className="home-page">
      {nombreMunicipio && (
        <SeoHead
          title={t('seo.tituloMunicipio', { municipio: nombreMunicipio })}
          description={t('seo.descMunicipio', { municipio: nombreMunicipio })}
          canonicalPath={municipalityPath(nombreMunicipio)}
        />
      )}
      {playas && !nombreMunicipio && (
        <SeoHead
          title={t('seo.tituloNoEncontrada')}
          description={t('seo.descNoEncontrada')}
          canonicalPath=""
          noindex
        />
      )}
      <div className="home-sticky-header ld-header-volver">
        <button
          className="pd-back-btn"
          onClick={() => history.goBack()}
          aria-label={t('detalle.volver')}
        >
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
        <div className="ld-header-textos">
          <p className="home-sticky-title">{nombreMunicipio ?? t('app.titulo')}</p>
          <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        </div>
        <HeaderActions />
      </div>
      <IonContent fullscreen>
        <div className="home-hero"><div className="home-hero-spacer" /></div>
        {!playas && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
          </div>
        )}
        {playas && nombreMunicipio && (
          <>
            <h1 className="ld-titular">
              {t('municipio.titulo', { municipio: nombreMunicipio })}
            </h1>
            <p className="ld-intro">{t('municipio.intro', { municipio: nombreMunicipio })}</p>
            <div className="beach-count">
              {tPlural('lista.contador', lista.length)}
              {condiciones.size > 0 && instanteCondiciones != null && (
                <>
                  {' · '}
                  <FreshnessLabel instant={instanteCondiciones} />
                </>
              )}
            </div>
            <div className="beach-list">
              {lista.map((p: Playa) => (
                <BeachCard key={p.codigo} beach={p} weather={condiciones.get(p.codigo)} />
              ))}
            </div>
          </>
        )}
        {playas && !nombreMunicipio && (
          <div className="home-empty">
            <p className="home-empty-text">{t('municipio.desconocido')}</p>
            <button className="ld-enlace" onClick={() => history.push('/playas')}>
              {t('nav.playas')}
            </button>
          </div>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MunicipioPage;
