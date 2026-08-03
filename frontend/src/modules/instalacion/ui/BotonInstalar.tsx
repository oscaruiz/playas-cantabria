import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { downloadOutline, shareOutline } from 'ionicons/icons';
import { useIdioma } from '../../../shared/i18n/IdiomaContext';
import { useInstalacion } from '../application/useInstalacion';
import './instalacion.css';

/**
 * Install chip. It renders NOTHING unless the browser can actually do
 * something: no chip for whoever already has the app, and none where neither
 * the API nor the manual route exists.
 *
 * `className` is how it borrows the look of whatever bar hosts it (the hero
 * passes `hp-badge`), so it stays a pill like its neighbours without this
 * module knowing anything about the page's palette.
 */
const BotonInstalar: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useIdioma();
  const { oferta, instalar } = useInstalacion();
  const [ayudaVisible, setAyudaVisible] = useState(false);

  if (!oferta) return null;

  const esIOS = oferta === 'ios';

  return (
    <>
      <button
        type="button"
        className={`instalar-chip${className ? ` ${className}` : ''}`}
        onClick={() => (esIOS ? setAyudaVisible((v) => !v) : instalar())}
        aria-expanded={esIOS ? ayudaVisible : undefined}
        aria-controls={esIOS ? 'instalar-ayuda' : undefined}
      >
        <IonIcon icon={esIOS ? shareOutline : downloadOutline} aria-hidden="true" />
        {t('instalar.chip')}
      </button>

      {esIOS && ayudaVisible && (
        <div className="instalar-ayuda" id="instalar-ayuda">
          <p className="instalar-ayuda__titulo">{t('instalar.iosTitulo')}</p>
          <ol className="instalar-ayuda__pasos">
            <li>{t('instalar.iosPaso1')}</li>
            <li>{t('instalar.iosPaso2')}</li>
          </ol>
        </div>
      )}
    </>
  );
};

export default BotonInstalar;
