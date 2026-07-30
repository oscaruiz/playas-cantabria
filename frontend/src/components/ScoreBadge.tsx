import React from 'react';
import { useIdioma } from '../i18n/IdiomaContext';
import './ScoreBadge.css';

type Tramo = 'alta' | 'media' | 'baja';

/** Color band of the score (aligned with the 60 threshold of "recomendadas"). */
function tramo(p: number): Tramo {
  if (p >= 60) return 'alta';
  if (p >= 40) return 'media';
  return 'baja';
}

interface ScoreBadgeProps {
  puntuacion: number;
  /** 'sm' for lists/cards, 'lg' for the detail header. */
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * Compact badge with a beach's score (0-100), colored by band.
 * Single source of the score: the backend ranking (featured endpoint).
 */
const ScoreBadge: React.FC<ScoreBadgeProps> = ({ puntuacion, size = 'sm', className }) => {
  const { t } = useIdioma();
  const p = Math.round(puntuacion);
  return (
    <span
      className={`score-badge score-badge--${size} score-badge--${tramo(p)}${className ? ` ${className}` : ''}`}
      aria-label={t('home.puntuacionAria', { n: p })}
    >
      <span className="score-badge-num" aria-hidden="true">{p}</span>
      {size === 'lg' && <span className="score-badge-max" aria-hidden="true">/100</span>}
    </span>
  );
};

export default ScoreBadge;
