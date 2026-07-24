import React from 'react';
import { useIdioma } from '../i18n/IdiomaContext';
import './ScoreBadge.css';

type Tramo = 'alta' | 'media' | 'baja';

/** Tramo de color de la puntuación (alineado con el umbral 60 de "recomendadas"). */
function tramo(p: number): Tramo {
  if (p >= 60) return 'alta';
  if (p >= 40) return 'media';
  return 'baja';
}

interface ScoreBadgeProps {
  puntuacion: number;
  /** 'sm' para listas/tarjetas, 'lg' para la cabecera del detalle. */
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * Badge compacto con la puntuación (0-100) de una playa, coloreado por tramo.
 * Fuente única de la puntuación: el ranking del backend (endpoint featured).
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
