import React from 'react';
import { useIdioma } from '../../i18n/IdiomaContext';
import { ClaveTexto } from '../../i18n/es';

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getTideStatus(
  entries: Array<{ time: string; type: 'pleamar' | 'bajamar'; minutes: number }>,
  isToday: boolean,
): { clave: ClaveTexto; className: string } | null {
  if (!isToday || entries.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Find which two events we are between
  for (let i = 0; i < entries.length; i++) {
    if (nowMinutes < entries[i].minutes) {
      // We are before this event → the tide is heading toward it
      const next = entries[i];
      if (next.type === 'pleamar') {
        return { clave: 'marea.subiendo', className: 'tide-status-rising' };
      } else {
        return { clave: 'marea.bajando', className: 'tide-status-falling' };
      }
    }
  }

  // After the day's last event: if the last one was `pleamar` → falling, and vice versa
  const last = entries[entries.length - 1];
  if (last.type === 'pleamar') {
    return { clave: 'marea.bajando', className: 'tide-status-falling' };
  }
  return { clave: 'marea.subiendo', className: 'tide-status-rising' };
}

/** Tides for the selected day only, sorted by time. */
const TidesSection: React.FC<{
  marea: { pleamar: string[]; bajamar: string[] };
  fuenteMareas: string | null;
  isToday: boolean;
}> = ({ marea, fuenteMareas, isToday }) => {
  const { t } = useIdioma();
  if (marea.pleamar.length === 0 && marea.bajamar.length === 0) return null;

  // Combine and sort by time
  const entries = [
    ...marea.pleamar.map((t) => ({ time: t, type: 'pleamar' as const, minutes: parseTimeMinutes(t) })),
    ...marea.bajamar.map((t) => ({ time: t, type: 'bajamar' as const, minutes: parseTimeMinutes(t) })),
  ].sort((a, b) => a.minutes - b.minutes);

  const status = getTideStatus(entries, isToday);

  return (
    <section className="tides-section">
      <h3 className="section-kicker">{t('detalle.mareas')}</h3>
      {status && (
        <div className={`tide-status ${status.className}`}>
          {status.className === 'tide-status-rising' ? '\u2197' : '\u2198'} {t(status.clave)}
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
      {fuenteMareas && (
        <div className="tides-source">{fuenteMareas.replace(/^\*/, '')}</div>
      )}
    </section>
  );
};

export default TidesSection;
