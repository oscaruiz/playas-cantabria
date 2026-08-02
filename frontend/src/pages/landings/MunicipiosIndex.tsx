import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import { Link } from 'react-router-dom';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import SeoHead from '../../shared/seo/SeoHead';
import { resumenMunicipios } from '../../shared/seo/landings';
import BottomNavBar from '../../shared/ui/BottomNavBar';
import SelectorIdioma from '../../shared/ui/SelectorIdioma';
import { useCatalogo } from './useCatalogo';
import './landings.css';

interface FilaMunicipio {
  municipio: string;
  ruta: string;
  total: number;
}

/** Index of every municipality with beaches, each linking to its page. */
const MunicipiosIndex: React.FC = () => {
  const { t, tPlural } = useIdioma();
  const { playas } = useCatalogo();

  const municipios = useMemo(
    () => resumenMunicipios(playas ?? []) as FilaMunicipio[],
    [playas]
  );

  return (
    <IonPage className="home-page">
      <SeoHead
        titulo={t('seo.tituloMunicipios')}
        descripcion={t('seo.descMunicipios')}
        rutaCanonica="/municipios"
      />
      <div className="home-sticky-header">
        <h1 className="home-sticky-title">{t('municipios.titulo')}</h1>
        <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        <SelectorIdioma />
      </div>
      <IonContent fullscreen>
        <div className="home-hero"><div className="home-hero-spacer" /></div>
        <p className="ld-intro">{t('municipios.intro')}</p>
        {!playas && (
          <div className="home-loading">
            <IonSpinner name="crescent" />
          </div>
        )}
        {playas && (
          <div className="ld-lista">
            {municipios.map((m) => (
              <Link
                key={m.ruta}
                to={m.ruta}
                className="ld-fila"
                aria-label={t('municipio.verPlayas', { municipio: m.municipio })}
              >
                <div className="ld-fila-nombre">
                  <p className="ld-fila-titulo">{m.municipio}</p>
                  <p className="ld-fila-municipio">{tPlural('lista.contador', m.total)}</p>
                </div>
                <span className="ld-fila-flecha" aria-hidden="true">&#8250;</span>
              </Link>
            ))}
          </div>
        )}
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

export default MunicipiosIndex;
