import React from 'react';
import { DayWindow, OutlookCause, WindowReason } from '../../../../../Dev/playas-cantabria/frontend/src/services/api';
import { useLanguage } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { TextKey } from '../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/es';
import { madridLocalHour } from '../../../../../Dev/playas-cantabria/frontend/src/shared/format/time';
import './BestTime.css';

const CHANGE: Record<OutlookCause, TextKey> = {
  despeja: 'ventana.cambio.despeja',
  nubla: 'ventana.cambio.nubla',
  sube_temperatura: 'ventana.cambio.subeTemperatura',
  baja_temperatura: 'ventana.cambio.bajaTemperatura',
  amaina_viento: 'ventana.cambio.amainaViento',
  arrecia_viento: 'ventana.cambio.arreciaViento',
  lluvia_prevista: 'ventana.cambio.lluviaPrevista',
};

const REASON: Record<WindowReason, TextKey> = {
  sin_lluvia: 'ventana.motivo.sinLluvia',
  despeja: 'ventana.motivo.despeja',
  sube_temperatura: 'ventana.motivo.subeTemperatura',
  amaina_viento: 'ventana.motivo.amainaViento',
};

/**
 * WHEN to go, composed from the API's structured window: "Mejor momento:
 * 11:00–14:00 · A partir de las 17:00 aumenta el viento". The hours come as
 * ISO instants and the cause as a key, so this is where language happens —
 * the backend cannot bake an hour into a Spanish phrase and stay translatable.
 * Renders nothing without a window: outside the beach window, hourly sources
 * down, or a day with no stretch worth recommending.
 *
 * With `detallada` (the detail page) it also says WHY the stretch won —
 * the motive against the rejected hours, or that nothing worsens until the
 * window closes. The home card stays compact and does not pass it.
 */
const BestTime: React.FC<{
  timeWindow?: DayWindow | null;
  detailed?: boolean;
}> = ({ timeWindow, detailed = false }) => {
  const { t } = useLanguage();
  if (!timeWindow) return null;

  // The window travels through caches (featured: fresh + a stale hour, plus
  // 5 min in this client): check it against the CLOCK, not just render it. A
  // finished window disappears; a started one keeps only its honest half.
  const now = Date.now();
  const startMs = Date.parse(timeWindow.inicio);
  const endMs = Date.parse(timeWindow.fin);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= now) return null;
  const started = startMs <= now;

  const start = madridLocalHour(timeWindow.inicio);
  const end = madridLocalHour(timeWindow.fin);
  if (!start || !end) return null;

  const cause = timeWindow.cambio?.causa ?? null;
  const changeHour = madridLocalHour(timeWindow.cambio?.desde);
  const change = cause && changeHour ? t(CHANGE[cause], { hora: changeHour }) : null;

  const reason = detailed && timeWindow.motivo ? t(REASON[timeWindow.motivo]) : null;
  const unchanged = detailed && !reason && !change ? t('ventana.sinCambios') : null;

  return (
    <div className="mejor-momento">
      <p className="mejor-momento-franja">
        <span className="mejor-momento-punto" aria-hidden="true" />
        {started ? t('ventana.hastaFin', { fin: end }) : t('ventana.mejor', { inicio: start, fin: end })}
      </p>
      {reason && <p className="mejor-momento-motivo">{reason}</p>}
      {change && <p className="mejor-momento-cambio">{change}</p>}
      {unchanged && <p className="mejor-momento-cambio">{unchanged}</p>}
    </div>
  );
};

export default BestTime;
