import React from 'react';
import { ForecastDayDTO } from '../../../../../../Dev/playas-cantabria/frontend/src/services/api';
import { capitalize } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/format/text';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { translateApiText } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/apiText';

function avisoLevelClass(level: number | null): string {
  if (level === 1) return 'warning-red';
  if (level === 2) return 'warning-orange';
  if (level === 3) return 'warning-yellow';
  return 'warning-green';
}

function uvColorClass(uv: number): string {
  if (uv <= 2) return 'uv-low';
  if (uv <= 5) return 'uv-moderate';
  if (uv <= 7) return 'uv-high';
  return 'uv-very-high';
}

/** Thermal sensation, UV badge and coastal warning for the selected day. */
const DailyStats: React.FC<{ day: ForecastDayDTO; embedded?: boolean }> = ({ day, embedded }) => {
  const { t, language } = useLanguage();
  const hasAny = day.sensacionTermica || day.indiceUV != null || (day.aviso && day.aviso.descripcion);
  if (!hasAny) return null;

  // `embedded`: rendered inside the "Previsión meteorológica AEMET" card,
  // so it omits its own `.detail-card` wrapper (avoids a card inside a card).
  const body = (
    <div className={`daily-stats-body${embedded ? ' daily-stats-embedded' : ''}`}>
        {day.sensacionTermica && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.sensacionTermica')}</span>
            <span className="daily-stat-value">{translateApiText(capitalize(day.sensacionTermica), language)}</span>
          </div>
        )}
        {day.indiceUV != null && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.indiceUV')}</span>
            <span className={`daily-stat-value uv-value ${uvColorClass(day.indiceUV)}`}>
              <span className="uv-swatch" aria-hidden="true" />
              {Math.round(day.indiceUV)}
              {day.nivelUV && ` \u2014 ${translateApiText(day.nivelUV.replace(/^índice ultravioleta\s*/i, ''), language)}`}
            </span>
          </div>
        )}
        {day.aviso && day.aviso.descripcion && (
          <div className="daily-stat-row">
            <span className="daily-stat-label">{t('detalle.avisoLitoral')}</span>
            <span className={`daily-stat-value ${avisoLevelClass(day.aviso.nivel)}`}>
              {translateApiText(capitalize(day.aviso.descripcion), language)}
            </span>
          </div>
        )}
      </div>
  );

  if (embedded) return body;
  return <div className="daily-stats-card">{body}</div>;
};

export default DailyStats;
