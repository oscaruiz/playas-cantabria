import React from 'react';
import { useLanguage } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import './ScoreBadge.css';

type Segment = 'alta' | 'media' | 'baja';

/** Color band of the score (aligned with the 60 threshold of "recomendadas"). */
function segment(p: number): Segment {
  if (p >= 60) return 'alta';
  if (p >= 40) return 'media';
  return 'baja';
}

interface ScoreBadgeProps {
  score: number;
  /** 'sm' for lists/cards, 'lg' for the detail header. */
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * Compact badge with a beach's score (0-100), colored by band.
 * Single source of the score: the backend ranking (featured endpoint).
 */
const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, size = 'sm', className }) => {
  const { t } = useLanguage();
  const p = Math.round(score);
  return (
    <span
      className={`score-badge score-badge--${size} score-badge--${segment(p)}${className ? ` ${className}` : ''}`}
      aria-label={t('home.puntuacionAria', { n: p })}
    >
      <span className="score-badge-num" aria-hidden="true">{p}</span>
      {size === 'lg' && <span className="score-badge-max" aria-hidden="true">/100</span>}
    </span>
  );
};

export default ScoreBadge;
