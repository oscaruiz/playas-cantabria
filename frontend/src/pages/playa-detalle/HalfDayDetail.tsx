import React from 'react';
import { HalfDayDTO } from '../../services/api';
import { capitalizar, emojiCielo } from '../../utils/beachHelpers';
import { useIdioma } from '../../i18n/IdiomaContext';
import { traducirTextoApi } from '../../i18n/apiText';

export function hasHalfDayData(h: HalfDayDTO): boolean {
  return h.cielo != null || h.viento != null || h.oleaje != null;
}

/** Morning / afternoon side by side. */
const HalfDayDetail: React.FC<{
  manana: HalfDayDTO;
  tarde: HalfDayDTO;
}> = ({ manana, tarde }) => {
  const { t, idioma } = useIdioma();
  const hasMorning = hasHalfDayData(manana);

  const renderBlock = (data: HalfDayDTO, period: 'morning' | 'afternoon') => {
    const label = period === 'morning' ? t('detalle.periodoManana') : t('detalle.periodoTarde');
    return (
      <div className={`halfday-block ${period}`}>
        <div className="halfday-block-label">{label}</div>
        <div className="halfday-block-rows">
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon" aria-hidden="true">{emojiCielo(data.cielo)}</span>
            <span>{traducirTextoApi(capitalizar(data.cielo), idioma) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-row-label">{t('detalle.viento')}</span>
            <span>{traducirTextoApi(capitalizar(data.viento), idioma) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-row-label">{t('detalle.oleaje')}</span>
            <span>{traducirTextoApi(capitalizar(data.oleaje), idioma) || '--'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`halfday-detail${hasMorning ? '' : ' single'}`}>
      {hasMorning && renderBlock(manana, 'morning')}
      {renderBlock(tarde, 'afternoon')}
    </div>
  );
};

export default HalfDayDetail;
