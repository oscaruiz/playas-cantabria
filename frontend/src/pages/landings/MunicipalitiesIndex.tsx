import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import SeoHead from '../../../../../../Dev/playas-cantabria/frontend/src/shared/seo/SeoHead';
import { municipalitiesSummary } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/seo/landings';
import BottomNavBar from '../../../../../../Dev/playas-cantabria/frontend/src/shared/ui/BottomNavBar';
import HeaderActions from '../../../../../../Dev/playas-cantabria/frontend/src/shared/ui/HeaderActions';
import { useCatalog } from '../../../../../../Dev/playas-cantabria/frontend/src/pages/landings/useCatalog';
import './landings.css';

interface MunicipalityRow {
  municipio: string;
  ruta: string;
  total: number;
}

/** Index of every municipality with beaches, each linking to its page. */
const MunicipalitiesIndex: React.FC = () => {
  const { t, tPlural } = useLanguage();
  const { beaches } = useCatalog();

  const municipalities = useMemo(
    () => municipalitiesSummary(beaches ?? []) as MunicipalityRow[],
    [beaches]
  );

  return (
    <IonPage className="home-page">
      <SeoHead
        title={t('seo.tituloMunicipios')}
        description={t('seo.descMunicipios')}
        canonicalPath="/municipios"
      />
      <div className="home-sticky-header">
        <div className="home-sticky-brand">
          <h1 className="home-sticky-title">{t('municipios.titulo')}</h1>
          <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        </div>
        <HeaderActions />
      </div>
      <IonContent fullscreen>
        <div className="home-hero"><div className="home-hero-spacer" /></div>
        <p className="ld-intro">{t('municipios.intro')}</p>
        {!beaches && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
          </div>
        )}
        {beaches && (
          <div className="ld-list">
            {municipalities.map((m) => (
              <Link
                key={m.ruta}
                to={m.ruta}
                className="ld-row"
                aria-label={t('municipio.verPlayas', { municipio: m.municipio })}
              >
                <div className="ld-row-name">
                  <p className="ld-row-title">{m.municipio}</p>
                  <p className="ld-row-municipality">{tPlural('lista.contador', m.total)}</p>
                </div>
                <span className="ld-row-arrow" aria-hidden="true">&#8250;</span>
              </Link>
            ))}
          </div>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MunicipalitiesIndex;
