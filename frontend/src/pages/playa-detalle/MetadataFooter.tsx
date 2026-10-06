import React from 'react';
import { useLanguage } from '../../shared/i18n/IdiomaContext';
import {
  AttributionNote,
  EstimatedValues,
} from '../../features/provenance/SourceAndFreshness';
import DataInfo from '../../features/provenance/InfoDatos';
import type { EstimatedField } from '../../services/api';

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
  warningZone: string | null;
  issued: string | null;
  /** Source that produced the forecast and the tides, as the API credits it. */
  source?: string | null;
  /** Source of the current observation shown in the hero, if any. */
  observationSource?: string | null;
  /** Values of the selected day that were derived, not measured or forecast. */
  estimated?: EstimatedField[] | null;
}> = ({ warningZone, issued, source, observationSource, estimated }) => {
  const { t } = useLanguage();
  const hasDistinctObservation =
    observationSource != null && observationSource !== source;
  if (!warningZone && !issued && !source && !hasDistinctObservation) return null;

  return (
    <DataInfo label="info.fuente" aria="info.aria.prevision" className="forecast-metadata">
      <AttributionNote source={source} />
      {hasDistinctObservation && <AttributionNote source={observationSource} />}
      {(warningZone || issued) && (
        <p className="procedencia-estatica">
          {warningZone && <span>{t('detalle.zonaAvisos', { zona: warningZone })}</span>}
          {warningZone && issued && <span> &middot; </span>}
          {issued && <span>{issued}</span>}
        </p>
      )}
      <EstimatedValues fields={estimated} />
    </DataInfo>
  );
};

export default MetadataFooter;
