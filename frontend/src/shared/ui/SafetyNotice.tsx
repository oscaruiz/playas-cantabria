import React from 'react';
import { IonIcon } from '@ionic/react';
import { informationCircleOutline } from 'ionicons/icons';
import { useIdioma } from '../i18n/IdiomaContext';
import './SafetyNotice.css';

const SafetyNotice: React.FC<{ tipo: 'banderas' | 'ranking'; sobreOscuro?: boolean }> = ({
  tipo,
  sobreOscuro = false,
}) => {
  const { t } = useIdioma();
  return (
    <p className={`safety-notice${sobreOscuro ? ' safety-notice--dark' : ''}`} role="note">
      <IonIcon icon={informationCircleOutline} aria-hidden="true" />
      <span>{t(tipo === 'banderas' ? 'aviso.banderas' : 'aviso.ranking')}</span>
    </p>
  );
};

export default SafetyNotice;
