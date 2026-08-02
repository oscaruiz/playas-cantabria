import React from 'react';
import { IonIcon } from '@ionic/react';
import { trendingUpOutline, trendingDownOutline, removeOutline } from 'ionicons/icons';
import { Pronostico, CausaPronostico } from '../services/api';
import { useIdioma } from '../i18n/IdiomaContext';
import { ClaveTexto } from '../i18n/es';
import './TrendBadge.css';

const DIRECCION: Record<Pronostico['direccion'], { clave: ClaveTexto; icono: string }> = {
  mejora: { clave: 'detalle.pronostico.mejora', icono: trendingUpOutline },
  empeora: { clave: 'detalle.pronostico.empeora', icono: trendingDownOutline },
  estable: { clave: 'detalle.pronostico.estable', icono: removeOutline },
};

const CAUSA: Record<CausaPronostico, ClaveTexto> = {
  despeja: 'detalle.pronostico.causa.despeja',
  nubla: 'detalle.pronostico.causa.nubla',
  sube_temperatura: 'detalle.pronostico.causa.subeTemperatura',
  baja_temperatura: 'detalle.pronostico.causa.bajaTemperatura',
  amaina_viento: 'detalle.pronostico.causa.amainaViento',
  arrecia_viento: 'detalle.pronostico.causa.arreciaViento',
  lluvia_prevista: 'detalle.pronostico.causa.lluviaPrevista',
};

interface TrendBadgeProps {
  pronostico?: Pronostico | null;
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
const TrendBadge: React.FC<TrendBadgeProps> = ({ pronostico, size = 'sm' }) => {
  const { t } = useIdioma();
  if (!pronostico) return null;

  const { direccion, delta } = pronostico;
  const causa = pronostico.causa ?? null;

  // In a list "Sin cambios" is a row of noise on every card that has nothing to
  // report. The detail has room to say it and a reason to: there the absence of
  // change is itself an answer to "what happens this afternoon?".
  if (size === 'sm' && direccion === 'estable') return null;

  const textoCausa = causa ? t(CAUSA[causa]) : null;

  // The points are the outlook's contribution to the score. With rain forecast
  // over a clearing sky the direction is "Empeora" while the delta is positive
  // (rain scores through the caps, not through the delta): showing "+5" there
  // reads as a contradiction, so it is left out. The detail already explains
  // that case with the cap line.
  const signoCoincide =
    (direccion === 'mejora' && delta > 0) || (direccion === 'empeora' && delta < 0);
  const mostrarPuntos = size === 'lg' && signoCoincide;

  return (
    <p
      className={`trend-badge trend-badge--${size} trend-badge--${direccion}`}
      aria-label={
        textoCausa
          ? t('detalle.pronostico.aria', {
              direccion: t(DIRECCION[direccion].clave),
              causa: textoCausa,
            })
          : t('detalle.pronostico.ariaSinCausa', { direccion: t(DIRECCION[direccion].clave) })
      }
    >
      <IonIcon icon={DIRECCION[direccion].icono} aria-hidden="true" />{' '}
      <span aria-hidden="true">{t(DIRECCION[direccion].clave)}</span>
      {textoCausa && (
        <>
          <span className="trend-badge-sep" aria-hidden="true">·</span>
          <span className="trend-badge-causa" aria-hidden="true">{textoCausa}</span>
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
      {mostrarPuntos && (
        <span className="trend-badge-delta" aria-hidden="true">
          {t('detalle.pronostico.puntos', { n: delta > 0 ? `+${delta}` : `${delta}` })}
        </span>
      )}
    </p>
  );
};

export default TrendBadge;
