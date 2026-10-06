import React from 'react';
import { HalfDayDTO } from '../../services/api';
import { skyEmoji } from '../../utils/beachHelpers';
import { capitalize } from '../../shared/format/texto';
import { useLanguage } from '../../shared/i18n/IdiomaContext';
import { translateApiText } from '../../shared/i18n/apiText';

export function hasHalfDayData(h: HalfDayDTO): boolean {
  return h.cielo != null || h.viento != null || h.oleaje != null;
}

/** Morning / afternoon side by side. */
const HalfDayDetail: React.FC<{
  morning: HalfDayDTO;
  afternoon: HalfDayDTO;
}> = ({ morning, afternoon }) => {
  const { t, language } = useLanguage();
  const hasMorning = hasHalfDayData(morning);

  const renderBlock = (data: HalfDayDTO, period: 'morning' | 'afternoon') => {
    const label = period === 'morning' ? t('detalle.periodoManana') : t('detalle.periodoTarde');
    return (
      <div className={`halfday-block ${period}`}>
        <div className="halfday-block-label">{label}</div>
        <div className="halfday-block-rows">
          <div className="halfday-block-row">
            <span className="halfday-block-row-icon" aria-hidden="true">{skyEmoji(data.cielo)}</span>
            <span>{translateApiText(capitalize(data.cielo), language) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-row-label">{t('detalle.viento')}</span>
            <span>{translateApiText(capitalize(data.viento), language) || '--'}</span>
          </div>
          <div className="halfday-block-row">
            <span className="halfday-row-label">{t('detalle.oleaje')}</span>
            <span>{translateApiText(capitalize(data.oleaje), language) || '--'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`halfday-detail${hasMorning ? '' : ' single'}`}>
      {hasMorning && renderBlock(morning, 'morning')}
      {renderBlock(afternoon, 'afternoon')}
    </div>
  );
};

export default HalfDayDetail;
