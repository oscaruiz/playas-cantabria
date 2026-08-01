import React from 'react';
import { DiaPrediccionDTO } from '../../services/api';
import { capitalizar } from '../../utils/beachHelpers';
import { useIdioma } from '../../i18n/IdiomaContext';
import { traducirTextoApi } from '../../i18n/apiText';

function avisoLevelClass(nivel: number | null): string {
  if (nivel === 1) return 'aviso-red';
  if (nivel === 2) return 'aviso-orange';
  if (nivel === 3) return 'aviso-yellow';
  return 'aviso-green';
}

function uvColorClass(uv: number): string {
  if (uv <= 2) return 'uv-low';
  if (uv <= 5) return 'uv-moderate';
  if (uv <= 7) return 'uv-high';
  return 'uv-very-high';
}

/** Thermal sensation, UV badge and coastal warning for the selected day. */
const DailyStats: React.FC<{ dia: DiaPrediccionDTO; embedded?: boolean }> = ({ dia, embedded }) => {
  const { t, idioma } = useIdioma();
  const hasAny = dia.sensacionTermica || dia.indiceUV != null || (dia.aviso && dia.aviso.descripcion);
  if (!hasAny) return null;

  // `embedded`: rendered inside the "Previsión meteorológica AEMET" card,
  // so it omits its own `.detail-card` wrapper (avoids a card inside a card).
  const body = (
    <div className={`daily-stats-body${embedded ? ' daily-stats-embedded' : ''}`}>
        {dia.sensacionTermica && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.sensacionTermica')}</span>
            <span className="daily-stat-value">{traducirTextoApi(capitalizar(dia.sensacionTermica), idioma)}</span>
          </div>
        )}
        {dia.indiceUV != null && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.indiceUV')}</span>
            <span className={`daily-stat-value uv-value ${uvColorClass(dia.indiceUV)}`}>
              <span className="uv-swatch" aria-hidden="true" />
              {Math.round(dia.indiceUV)}
              {dia.nivelUV && ` \u2014 ${traducirTextoApi(dia.nivelUV.replace(/^índice ultravioleta\s*/i, ''), idioma)}`}
            </span>
          </div>
        )}
        {dia.aviso && dia.aviso.descripcion && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.avisoLitoral')}</span>
            <span className={`daily-stat-value ${avisoLevelClass(dia.aviso.nivel)}`}>
              {traducirTextoApi(capitalizar(dia.aviso.descripcion), idioma)}
            </span>
          </div>
        )}
      </div>
  );

  if (embedded) return body;
  return <div className="daily-stats-card">{body}</div>;
};

export default DailyStats;
