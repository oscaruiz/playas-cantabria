import React from 'react';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import {
  AttributionNote,
  EstimatedValues,
} from '../../features/provenance/SourceAndFreshness';
import InfoDatos from '../../features/provenance/InfoDatos';
import type { CampoEstimado } from '../../services/api';

/**
 * Everything the AEMET column has to declare — who elaborated the forecast and
 * the tides, when, for which warning zone, who observed the current sky, and
 * which values nobody measured — under one ⓘ at the end of the column.
 *
 * It closes the column instead of sitting in a page footer: AEMET requires its
 * notice to accompany the information, and one tap away from the forecast is
 * still next to the forecast.
 */
const MetadataFooter: React.FC<{
  zonaAvisos: string | null;
  elaboracion: string | null;
  /** Source that produced the forecast and the tides, as the API credits it. */
  fuente?: string | null;
  /** Source of the current observation shown in the hero, if any. */
  fuenteObservacion?: string | null;
  /** Values of the selected day that were derived, not measured or forecast. */
  estimados?: CampoEstimado[] | null;
}> = ({ zonaAvisos, elaboracion, fuente, fuenteObservacion, estimados }) => {
  const { t } = useIdioma();
  const hayObservacionDistinta =
    fuenteObservacion != null && fuenteObservacion !== fuente;
  if (!zonaAvisos && !elaboracion && !fuente && !hayObservacionDistinta) return null;

  return (
    <InfoDatos etiqueta="info.fuente" aria="info.aria.prevision" className="forecast-metadata">
      <AttributionNote fuente={fuente} />
      {hayObservacionDistinta && <AttributionNote fuente={fuenteObservacion} />}
      {(zonaAvisos || elaboracion) && (
        <p className="procedencia-estatica">
          {zonaAvisos && <span>{t('detalle.zonaAvisos', { zona: zonaAvisos })}</span>}
          {zonaAvisos && elaboracion && <span> &middot; </span>}
          {elaboracion && <span>{elaboracion}</span>}
        </p>
      )}
      <EstimatedValues campos={estimados} />
    </InfoDatos>
  );
};

export default MetadataFooter;
