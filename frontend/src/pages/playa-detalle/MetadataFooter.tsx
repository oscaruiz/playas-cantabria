import React from 'react';
import { useIdioma } from '../../shared/i18n/IdiomaContext';

/** Warning zone and AEMET elaboration timestamp, under the forecast. */
const MetadataFooter: React.FC<{
  zonaAvisos: string | null;
  elaboracion: string | null;
}> = ({ zonaAvisos, elaboracion }) => {
  const { t } = useIdioma();
  if (!zonaAvisos && !elaboracion) return null;
  return (
    <div className="forecast-metadata">
      {zonaAvisos && <span>{t('detalle.zonaAvisos', { zona: zonaAvisos })}</span>}
      {zonaAvisos && elaboracion && <span> &middot; </span>}
      {elaboracion && <span>{elaboracion}</span>}
    </div>
  );
};

export default MetadataFooter;
