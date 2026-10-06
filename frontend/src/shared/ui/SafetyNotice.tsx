import React from 'react';
import { IonIcon } from '@ionic/react';
import { informationCircleOutline } from 'ionicons/icons';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import './SafetyNotice.css';

const SafetyNotice: React.FC<{ kind: 'banderas' | 'ranking'; onDark?: boolean }> = ({
  kind,
  onDark = false,
}) => {
  const { t } = useLanguage();
  return (
    <p className={`safety-notice${onDark ? ' safety-notice--dark' : ''}`} role="note">
      <IonIcon icon={informationCircleOutline} aria-hidden="true" />
      <span>{t(kind === 'banderas' ? 'aviso.banderas' : 'aviso.ranking')}</span>
    </p>
  );
};

export default SafetyNotice;
