import React from 'react';
import { IonIcon } from '@ionic/react';
import { trendingUpOutline, trendingDownOutline, removeOutline } from 'ionicons/icons';
import { Outlook, OutlookCause } from '../services/api';
import { useLanguage } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { TextKey } from '../shared/i18n/es';
import './TrendBadge.css';

const DIRECTION: Record<Outlook['direccion'], { labelKey: TextKey; icon: string }> = {
  mejora: { labelKey: 'detalle.pronostico.mejora', icon: trendingUpOutline },
  empeora: { labelKey: 'detalle.pronostico.empeora', icon: trendingDownOutline },
  estable: { labelKey: 'detalle.pronostico.estable', icon: removeOutline },
};

const CAUSE: Record<OutlookCause, TextKey> = {
  despeja: 'detalle.pronostico.causa.despeja',
  nubla: 'detalle.pronostico.causa.nubla',
  sube_temperatura: 'detalle.pronostico.causa.subeTemperatura',
  baja_temperatura: 'detalle.pronostico.causa.bajaTemperatura',
  amaina_viento: 'detalle.pronostico.causa.amainaViento',
  arrecia_viento: 'detalle.pronostico.causa.arreciaViento',
  lluvia_prevista: 'detalle.pronostico.causa.lluviaPrevista',
};

interface TrendBadgeProps {
  outlook?: Outlook | null;
  /** 'sm' for lists, cards and the map popup; 'lg' for the detail header. */
  size?: 'sm' | 'lg';
}

/**
 * Where this beach is heading in the next few hours, and why.
 *
 * The score already carries the adjustment (the backend folds it in, up to ±8),
 * so without this the beach moved up or down the ranking with nothing on screen
 * to explain it. The cause is what makes it actionable: "Mejora" on its own does
 * not tell anyone whether to wait, "Mejora · se despeja" does.
 */
const TrendBadge: React.FC<TrendBadgeProps> = ({ outlook, size = 'sm' }) => {
  const { t } = useLanguage();
  if (!outlook) return null;

  const { direccion: direction, delta } = outlook;
  const cause = outlook.causa ?? null;

  // In a list "Sin cambios" is a row of noise on every card that has nothing to
  // report. The detail has room to say it and a reason to: there the absence of
  // change is itself an answer to "what happens this afternoon?".
  if (size === 'sm' && direction === 'estable') return null;

  const causeText = cause ? t(CAUSE[cause]) : null;

  // The points are the outlook's contribution to the score. With rain forecast
  // over a clearing sky the direction is "Empeora" while the delta is positive
  // (rain scores through the caps, not through the delta): showing "+5" there
  // reads as a contradiction, so it is left out. The detail already explains
  // that case with the cap line.
  const signMatches =
    (direction === 'mejora' && delta > 0) || (direction === 'empeora' && delta < 0);
  const showPoints = size === 'lg' && signMatches;

  return (
    <p
      className={`trend-badge trend-badge--${size} trend-badge--${direction}`}
      aria-label={
        causeText
          ? t('detalle.pronostico.aria', {
              direccion: t(DIRECTION[direction].labelKey),
              causa: causeText,
            })
          : t('detalle.pronostico.ariaSinCausa', { direccion: t(DIRECTION[direction].labelKey) })
      }
    >
      <IonIcon icon={DIRECTION[direction].icon} aria-hidden="true" />{' '}
      <span aria-hidden="true">{t(DIRECTION[direction].labelKey)}</span>
      {causeText && (
        <>
          <span className="trend-badge-sep" aria-hidden="true">·</span>
          <span className="trend-badge-causa" aria-hidden="true">{causeText}</span>
        </>
      )}
      {size === 'lg' && (
        <>
          <span className="trend-badge-sep" aria-hidden="true">·</span>
          <span className="trend-badge-hint" aria-hidden="true">
            {t('detalle.pronostico.titulo')}
          </span>
        </>
      )}
      {showPoints && (
        <span className="trend-badge-delta" aria-hidden="true">
          {t('detalle.pronostico.puntos', { n: delta > 0 ? `+${delta}` : `${delta}` })}
        </span>
      )}
    </p>
  );
};

export default TrendBadge;
