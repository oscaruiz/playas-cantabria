import React from 'react';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { TextKey } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/es';

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getTideStatus(
  entries: Array<{ time: string; type: 'pleamar' | 'bajamar'; minutes: number }>,
  isToday: boolean,
): { labelKey: TextKey; className: string } | null {
  if (!isToday || entries.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Find which two events we are between
  for (let i = 0; i < entries.length; i++) {
    if (nowMinutes < entries[i].minutes) {
      // We are before this event → the tide is heading toward it
      const next = entries[i];
      if (next.type === 'pleamar') {
        return { labelKey: 'marea.subiendo', className: 'tide-status-rising' };
      } else {
        return { labelKey: 'marea.bajando', className: 'tide-status-falling' };
      }
    }
  }

  // After the day's last event: if the last one was `pleamar` → falling, and vice versa
  const last = entries[entries.length - 1];
  if (last.type === 'pleamar') {
    return { labelKey: 'marea.bajando', className: 'tide-status-falling' };
  }
  return { labelKey: 'marea.subiendo', className: 'tide-status-rising' };
}

/** Tides for the selected day only, sorted by time. */
const TidesSection: React.FC<{
  tide: { pleamar: string[]; bajamar: string[] };
  /** Reference port the times belong to (AEMET's own annotation). */
  tideSource: string | null;
  isToday: boolean;
  /**
   * Present when these are NOT this beach's own tides: it has no AEMET
   * sheet, so the nearest beach's table is shown instead. Tide tables are
   * always relative to a reference point anyway — this just says which one.
   */
  reference?: { playa: string; distanciaKm: number };
}> = ({ tide, tideSource, isToday, reference }) => {
  const { t } = useLanguage();
  if (tide.pleamar.length === 0 && tide.bajamar.length === 0) return null;

  // Combine and sort by time
  const entries = [
    ...tide.pleamar.map((t) => ({ time: t, type: 'pleamar' as const, minutes: parseTimeMinutes(t) })),
    ...tide.bajamar.map((t) => ({ time: t, type: 'bajamar' as const, minutes: parseTimeMinutes(t) })),
  ].sort((a, b) => a.minutes - b.minutes);

  const status = getTideStatus(entries, isToday);

  return (
    <section className="tides-section">
      <h3 className="section-kicker">{t('detalle.mareas')}</h3>
      {reference && (
        <p className="tides-referencia-aviso">
          {t('marea.referenciaAviso', {
            playa: reference.playa,
            km: Math.round(reference.distanciaKm * 10) / 10,
          })}
        </p>
      )}
      {status && (
        <div className={`tide-status ${status.className}`}>
          {status.className === 'tide-status-rising' ? '\u2197' : '\u2198'} {t(status.labelKey)}
        </div>
      )}
      <div className="tides-list">
        {entries.map((entry, i) => (
          <div className={`tide-entry ${entry.type}`} key={i}>
            <span className={`tide-arrow ${entry.type === 'pleamar' ? 'up' : 'down'}`} aria-hidden="true">
              {entry.type === 'pleamar' ? '\u2191' : '\u2193'}
            </span>
            <span className="tide-label">{entry.type === 'pleamar' ? t('marea.pleamar') : t('marea.bajamar')}</span>
            <span className="tide-time-value">{entry.time}</span>
          </div>
        ))}
      </div>
      {/* El puerto de referencia es DATO, no letra pequeña: sin él las horas
          no significan nada. El crédito de AEMET, que publica esta tabla, va
          en la ⓘ que cierra la columna — es la misma hoja que la previsión. */}
      {tideSource && (
        <div className="tides-source">{tideSource.replace(/^\*/, '')}</div>
      )}
    </section>
  );
};

export default TidesSection;
