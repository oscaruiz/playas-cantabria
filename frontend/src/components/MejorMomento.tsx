import React from 'react';
import { VentanaDia, CausaPronostico } from '../services/api';
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

/**
 * WHEN to go, composed from the API's structured window: "Mejor momento:
 * 11:00–14:00 · A partir de las 17:00 aumenta el viento". The hours come as
 * ISO instants and the cause as a key, so this is where language happens —
 * the backend cannot bake an hour into a Spanish phrase and stay translatable.
 * Renders nothing without a window: outside the beach window, hourly sources
 * down, or a day with no stretch worth recommending.
 */
const MejorMomento: React.FC<{ ventana?: VentanaDia | null }> = ({ ventana }) => {
  const { t } = useIdioma();
  if (!ventana) return null;

  const inicio = horaLocalMadrid(ventana.inicio);
  const fin = horaLocalMadrid(ventana.fin);
  if (!inicio || !fin) return null;

  const causa = ventana.cambio?.causa ?? null;
  const horaCambio = horaLocalMadrid(ventana.cambio?.desde);
  const cambio = causa && horaCambio ? t(CAMBIO[causa], { hora: horaCambio }) : null;

  return (
    <div className="mejor-momento">
      <p className="mejor-momento-franja">
        <span className="mejor-momento-punto" aria-hidden="true" />
        {t('ventana.mejor', { inicio, fin })}
      </p>
      {cambio && <p className="mejor-momento-cambio">{cambio}</p>}
    </div>
  );
};

export default MejorMomento;
