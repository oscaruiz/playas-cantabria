import React from 'react';
import { BeachDetail } from '../../../../../../Dev/playas-cantabria/frontend/src/services/api';
import {
  flagColorClass,
  flagStatus,
  lastRecordedFlag,
  lifeguardOperator,
} from '../../../../../../Dev/playas-cantabria/frontend/src/utils/beachHelpers';
import { madridDate, madridLocalHour } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/format/time';
import { capitalize } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/format/text';
import { FreshnessLabel } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/SourceAndFreshness';
import SafetyNotice from '../../../../../../Dev/playas-cantabria/frontend/src/shared/ui/SafetyNotice';
import { normalizeInstant } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/provenance';
import { useLanguage, Language, TranslateFn } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { translateApiText, flagStatusKey, translateOperator } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/apiText';
import { dayName, formatShortDate } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/dates';

/** "Registered today / yesterday / on <date> at HH:MM" — moment in Madrid time. */
function registeredText(iso: string, t: TranslateFn, language: Language): string {
  const hour = madridLocalHour(iso);
  if (!hour) return '';
  const now = new Date();
  const day = madridDate(new Date(iso));
  if (day === madridDate(now)) return t('detalle.registradaHoy', { hora: hour });
  if (day === madridDate(new Date(now.getTime() - 86400000))) {
    return t('detalle.registradaAyer', { hora: hour });
  }
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const name = capitalize(dayName(new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay(), language));
  return t('detalle.registradaFecha', {
    fecha: formatShortDate(name, dayOfMonth, month - 1, language),
    hora: hour,
  });
}

const FlagBanner: React.FC<{
  redCross?: BeachDetail['cruzRoja'];
  /** Beach whose operator names the banner; absent = the legacy Cruz Roja one. */
  beach?: Pick<BeachDetail, 'fuenteBanderas'>;
}> = ({ redCross, beach }) => {
  const { t, language } = useLanguage();
  const operator = lifeguardOperator(beach);
  const status = flagStatus(redCross);
  // 'sinDatos' (within hours but no capture yet, transient): we show no banner.
  // No operator: there is no flag to report here at all.
  if (status === 'sinDatos' || !operator) {
    return null;
  }

  // Outside of hours there is no flag in force, but the last registered one is shown
  // (dimmed color + when it was flying) as long as it remains informative.
  const last = status === 'fueraDeHorario' ? lastRecordedFlag(redCross) : null;

  // Full color is only for the flag in force ('color'); with no flag to
  // show, neutral pennant even if a color is stored.
  const colorClass = status === 'color'
    ? flagColorClass(redCross!.bandera)
    : last
      ? `${flagColorClass(last.bandera)} dimmed`
      : 'unknown';
  const flagCaptureMs =
    status === 'color' ? normalizeInstant(redCross?.ultimaActualizacion) : null;

  return (
    <div className="flag-banner">
      <span className={`flag-pennant ${colorClass}`} role="img" aria-label={t('detalle.banderaAria')} />
      <div className="flag-info">
        <div className="flag-label">
          {t('detalle.estadoBano', { operador: translateOperator(operator, language) })}
        </div>
        <div className="flag-value">
          {last
            ? t('bandera.ultimaRegistrada', {
                bandera: capitalize(translateApiText(last.bandera, language)),
              })
            : t(flagStatusKey(status, redCross!.bandera))}
        </div>
        {redCross!.horario && (
          <div className="flag-schedule">{t('detalle.vigilancia', { horario: redCross!.horario })}</div>
        )}
        {last && <div className="flag-schedule">{registeredText(last.registradaIso, t, language)}</div>}
        {flagCaptureMs != null && (
          <div className="flag-schedule">
            <FreshnessLabel instant={flagCaptureMs} capitalized />
          </div>
        )}
      </div>
      {/* Solo el aviso, y por eso se llama «Aviso». El crédito del operador
          vive en la tarjeta de vigilancia, que se pinta siempre que hay
          operador —también cuando este banner no— así que allí cubre todos
          los casos y aquí solo sería un duplicado. */}
      <SafetyNotice kind="banderas" onDark />
    </div>
  );
};

export default FlagBanner;
