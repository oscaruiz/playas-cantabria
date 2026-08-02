import React, { useMemo } from 'react';
import { IonPage, IonContent, IonFooter, IonSpinner } from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
import { Playa } from '../../services/api';
import { useIdioma } from '../../i18n/IdiomaContext';
import SeoHead from '../../seo/SeoHead';
import { playasDeMunicipioSlug, rutaMunicipio } from '../../seo/landings';
import BottomNavBar from '../../components/BottomNavBar';
import SelectorIdioma from '../../components/SelectorIdioma';
import FilaPlaya from './FilaPlaya';
import { useCatalogo } from './useCatalogo';
import './landings.css';

/** The beaches of one municipality, each linking to its canonical page. */
const MunicipioPage: React.FC = () => {
  const { municipio } = useParams<{ municipio: string }>();
  const history = useHistory();
  const { t, tPlural } = useIdioma();
  const { playas, condiciones } = useCatalogo();

  const lista = useMemo(
    () =>
      (playasDeMunicipioSlug(playas ?? [], municipio) as Playa[]).sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      ),
    [playas, municipio]
  );
  const nombreMunicipio = lista[0]?.municipio ?? null;

  return (
    <IonPage className="home-page">
      {nombreMunicipio && (
        <SeoHead
          titulo={t('seo.tituloMunicipio', { municipio: nombreMunicipio })}
          descripcion={t('seo.descMunicipio', { municipio: nombreMunicipio })}
          rutaCanonica={rutaMunicipio(nombreMunicipio)}
        />
      )}
      <div className="home-sticky-header">
        <h1 className="home-sticky-title">
          {nombreMunicipio ? t('municipio.titulo', { municipio: nombreMunicipio }) : t('app.titulo')}
        </h1>
        <p className="home-sticky-subtitle">{t('app.titulo')}</p>
        <SelectorIdioma />
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
            <p className="ld-intro">{t('municipio.intro', { municipio: nombreMunicipio })}</p>
            <div className="beach-count">{tPlural('lista.contador', lista.length)}</div>
            <div className="ld-lista">
              {lista.map((p: Playa) => (
                <FilaPlaya key={p.codigo} playa={p} condiciones={condiciones.get(p.codigo) ?? null} />
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
