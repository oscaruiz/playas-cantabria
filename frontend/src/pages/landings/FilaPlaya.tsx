import React from 'react';
import { useHistory } from 'react-router-dom';
import { Playa, FeaturedBeach } from '../../services/api';
import { emojiCielo, flagColorClass } from '../../utils/beachHelpers';
import { useIdioma } from '../../i18n/IdiomaContext';
import { traducirTextoApi } from '../../i18n/apiText';
import { rutaPlaya } from '../../seo/beachUrls';

/**
 * Compact beach row for municipality/landing pages: static identity plus
 * current conditions WHEN the ranking provided them — never inferred.
 */
const FilaPlaya: React.FC<{
  playa: Playa;
  condiciones: FeaturedBeach | null;
}> = ({ playa, condiciones }) => {
  const history = useHistory();
  const { t, idioma } = useIdioma();
  const flagClass = condiciones?.bandera ? flagColorClass(condiciones.bandera) : null;
  const ir = () => history.push(rutaPlaya(playa));

  return (
    <div
      className="ld-fila"
      role="link"
      tabIndex={0}
      aria-label={t('comun.verDetalleDe', { nombre: `${playa.nombre}, ${playa.municipio}` })}
      onClick={ir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ir();
        }
      }}
    >
      {condiciones && (
        <span className="ld-fila-clima" aria-hidden="true">
          {emojiCielo(condiciones.descripcionClima)}
          {condiciones.temperatura != null && ` ${Math.round(condiciones.temperatura)}°`}
        </span>
      )}
      <div className="ld-fila-nombre">
        <p className="ld-fila-titulo">{playa.nombre}</p>
        <p className="ld-fila-municipio">{playa.municipio}</p>
      </div>
      {flagClass && flagClass !== 'unknown' && condiciones?.bandera && (
        <span
          className={`hp-flag-dot hp-flag-${flagClass}`}
          aria-label={t('home.banderaAria', { bandera: traducirTextoApi(condiciones.bandera, idioma) })}
        />
      )}
      <span className="ld-fila-flecha" aria-hidden="true">&#8250;</span>
    </div>
  );
};

export default FilaPlaya;
