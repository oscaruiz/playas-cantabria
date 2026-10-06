import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { downloadOutline, openOutline, shareOutline } from 'ionicons/icons';
import { useLanguage } from '../../../shared/i18n/IdiomaContext';
import { useInstall } from '../application/useInstalacion';
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
const InstallButton: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useLanguage();
  const { offer, install, open } = useInstall();
  const [helpVisible, setHelpVisible] = useState(false);

  if (!offer) return null;

  const isIOS = offer === 'ios';
  const isOpenAction = offer === 'open';

  return (
    <>
      <button
        type="button"
        className={`instalar-chip${className ? ` ${className}` : ''}`}
        onClick={() => (isIOS ? setHelpVisible((v) => !v) : isOpenAction ? open() : install())}
        aria-expanded={isIOS ? helpVisible : undefined}
        aria-controls={isIOS ? 'instalar-ayuda' : undefined}
      >
        <IonIcon icon={isIOS ? shareOutline : isOpenAction ? openOutline : downloadOutline} aria-hidden="true" />
        {t(isOpenAction ? 'instalar.abrir' : 'instalar.chip')}
      </button>

      {isIOS && helpVisible && (
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

export default InstallButton;
