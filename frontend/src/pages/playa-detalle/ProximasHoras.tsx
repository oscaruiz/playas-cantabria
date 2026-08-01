import React from 'react';
import { IonIcon } from '@ionic/react';
import { sunnyOutline, partlySunnyOutline, cloudyOutline } from 'ionicons/icons';
import { PrevisionHora } from '../../services/api';
import { useIdioma } from '../../i18n/IdiomaContext';
import { horaLocalMadrid } from '../../utils/beachHelpers';

/** Cloud cover → the same three states the score uses (clear / scattered / broken). */
function iconoDeNubes(pct: number | null): string {
  if (pct == null) return partlySunnyOutline;
  if (pct <= 25) return sunnyOutline;
  if (pct <= 50) return partlySunnyOutline;
  return cloudyOutline;
}

/**
 * The next few hours, hour by hour. It lives next to the tides and not inside
 * the score's disclosure because it answers a question of its own — "if I go
 * later, what do I find?" — which nobody thinks to look for under "how the
 * score is calculated".
 *
 * Renders nothing when there are no slots: outside the beach window, or with
 * Open-Meteo down.
 */
const ProximasHoras: React.FC<{
  horas?: PrevisionHora[] | null;
  fuente?: string | null;
}> = ({ horas, fuente }) => {
  const { t } = useIdioma();
  if (!horas || horas.length === 0) return null;

  return (
    <section className="proximas-horas-section">
      <h3 className="section-kicker">{t('detalle.pronostico.titulo')}</h3>
      <ul className="pd-horas">
        {horas.map((h) => (
          /* Una frase por hora para quien no ve la tira: la nubosidad solo la
             cuenta el icono, y el icono es decorativo. */
          <li
            className="pd-hora"
            key={h.horaIso}
            aria-label={t('detalle.pronostico.ariaHora', {
              hora: horaLocalMadrid(h.horaIso) ?? '--:--',
              nubes: h.nubesPct ?? '--',
              temp: h.temperaturaC != null ? Math.round(h.temperaturaC) : '--',
              viento: h.vientoMs != null ? Math.round(h.vientoMs) : '--',
            })}
          >
            <span className="pd-hora-reloj" aria-hidden="true">
              {horaLocalMadrid(h.horaIso) ?? '--:--'}
            </span>
            <IonIcon className="pd-hora-icono" icon={iconoDeNubes(h.nubesPct)} aria-hidden="true" />
            <span className="pd-hora-temp" aria-hidden="true">
              {h.temperaturaC != null ? `${Math.round(h.temperaturaC)}°` : '--'}
            </span>
            <span className="pd-hora-viento" aria-hidden="true">
              {h.vientoMs != null ? `${Math.round(h.vientoMs)} m/s` : '--'}
            </span>
          </li>
        ))}
      </ul>
      {/* Quién lo pronostica. Misma frase que el pie de la ficha, para no
          inventar una segunda forma de decir lo mismo. */}
      {fuente && (
        <div className="proximas-horas-fuente">{t('detalle.datosMeteo', { fuente })}</div>
      )}
    </section>
  );
};

export default ProximasHoras;
