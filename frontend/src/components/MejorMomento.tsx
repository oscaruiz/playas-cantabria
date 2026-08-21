import React from 'react';
import { VentanaDia, CausaPronostico, MotivoVentana } from '../services/api';
import { useIdioma } from '../shared/i18n/IdiomaContext';
import { ClaveTexto } from '../shared/i18n/es';
import { horaLocalMadrid } from '../shared/format/tiempo';
import './MejorMomento.css';

const CAMBIO: Record<CausaPronostico, ClaveTexto> = {
  despeja: 'ventana.cambio.despeja',
  nubla: 'ventana.cambio.nubla',
  sube_temperatura: 'ventana.cambio.subeTemperatura',
  baja_temperatura: 'ventana.cambio.bajaTemperatura',
  amaina_viento: 'ventana.cambio.amainaViento',
  arrecia_viento: 'ventana.cambio.arreciaViento',
  lluvia_prevista: 'ventana.cambio.lluviaPrevista',
};

const MOTIVO: Record<MotivoVentana, ClaveTexto> = {
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
const MejorMomento: React.FC<{
  ventana?: VentanaDia | null;
  detallada?: boolean;
}> = ({ ventana, detallada = false }) => {
  const { t } = useIdioma();
  if (!ventana) return null;

  // The window travels through caches (featured: fresh + a stale hour, plus
  // 5 min in this client): check it against the CLOCK, not just render it. A
  // finished window disappears; a started one keeps only its honest half.
  const ahora = Date.now();
  const inicioMs = Date.parse(ventana.inicio);
  const finMs = Date.parse(ventana.fin);
  if (!Number.isFinite(inicioMs) || !Number.isFinite(finMs) || finMs <= ahora) return null;
  const empezada = inicioMs <= ahora;

  const inicio = horaLocalMadrid(ventana.inicio);
  const fin = horaLocalMadrid(ventana.fin);
  if (!inicio || !fin) return null;

  const causa = ventana.cambio?.causa ?? null;
  const horaCambio = horaLocalMadrid(ventana.cambio?.desde);
  const cambio = causa && horaCambio ? t(CAMBIO[causa], { hora: horaCambio }) : null;

  const motivo = detallada && ventana.motivo ? t(MOTIVO[ventana.motivo]) : null;
  const sinCambios = detallada && !motivo && !cambio ? t('ventana.sinCambios') : null;

  return (
    <div className="mejor-momento">
      <p className="mejor-momento-franja">
        <span className="mejor-momento-punto" aria-hidden="true" />
        {empezada ? t('ventana.hastaFin', { fin }) : t('ventana.mejor', { inicio, fin })}
      </p>
      {motivo && <p className="mejor-momento-motivo">{motivo}</p>}
      {cambio && <p className="mejor-momento-cambio">{cambio}</p>}
      {sinCambios && <p className="mejor-momento-cambio">{sinCambios}</p>}
    </div>
  );
};

export default MejorMomento;
