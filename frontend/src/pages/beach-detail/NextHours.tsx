import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  sunnyOutline,
  partlySunnyOutline,
  cloudyOutline,
  rainyOutline,
  chevronBackOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { HourlyForecast, DayWindow } from '../../../../../../Dev/playas-cantabria/frontend/src/services/api';
import BestTime from '../../../../../../Dev/playas-cantabria/frontend/src/components/BestTime';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import { madridLocalHour } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/format/time';
import { hourlyForecastProvenance } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/provenance';
import { todayLabelMadrid } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/dates';
import { sourceAttribution } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/attributions';
import { AttributionNote, SourceAndFreshness } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/SourceAndFreshness';
import DataInfo from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/DataInfo';

/** Cloud cover → the same three states the score uses (clear / scattered / broken). */
function cloudIcon(pct: number | null): string {
  if (pct == null) return partlySunnyOutline;
  if (pct <= 25) return sunnyOutline;
  if (pct <= 50) return partlySunnyOutline;
  return cloudyOutline;
}

/**
 * The next few hours, hour by hour. It lives next to the tides and not inside
 * the score's disclosure because it answers a question of its own — "if I go
 * later, what do I find?" — which nobody thinks to look for under "how the
 * score is calculated".
 *
 * The day window ("mejor momento") shares this card: it is the conclusion the
 * hours above it back up, drawn under them and above the source credit.
 *
 * Renders nothing when there is neither an hourly strip nor a window: outside
 * the beach window, or with both hourly sources down.
 */
const NextHours: React.FC<{
  hours?: HourlyForecast[] | null;
  source?: string | null;
  timeWindow?: DayWindow | null;
}> = ({ hours, source, timeWindow }) => {
  const { t, language } = useLanguage();
  const hasHours = (hours?.length ?? 0) > 0;
  // The strip is always TODAY's remaining hours: with the day selector right
  // above, the title must say which day it belongs to (Madrid's day — the
  // hours are Madrid hours).
  const title = t('detalle.pronostico.tituloRestoDia', { dia: todayLabelMadrid(language) });

  // Scroll affordance: the strip overflows on phones, and a clean cut at the
  // card edge reads as "this is everything". Fixed-width hours make the last
  // visible one PEEK out half-cut, and an edge fade appears on whichever side
  // still hides content — the two standard signals for a horizontal rail.
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const [moreAfter, setMoreAfter] = useState(false);
  const [moreBefore, setMoreBefore] = useState(false);

  const measureScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setMoreBefore(el.scrollLeft > 1);
    setMoreAfter(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measureScroll();
    // The container resizes with the viewport (rotation, window resize).
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureScroll, hours]);

  // The arrows both SIGNAL the rail moves and move it: most of a screenful
  // per press, with an overlap so no hour is ever skipped past unseen.
  const scroll = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const reduced =
      typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  if (!hasHours && !timeWindow) return null;

  // Does this hour's SLOT overlap the recommended window? By interval, not by
  // start: the in-progress slot can start before the (clamped) window start
  // and still be the hour the window is recommending right now. The slot end
  // is the next slot's start; the last one borrows the previous step.
  const list = hours ?? [];
  const inWindow = (i: number): boolean => {
    if (!timeWindow) return false;
    const startMs = Date.parse(timeWindow.inicio);
    const endMs = Date.parse(timeWindow.fin);
    const slotStart = Date.parse(list[i].horaIso);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(slotStart)) {
      return false;
    }
    const next = i + 1 < list.length ? Date.parse(list[i + 1].horaIso) : NaN;
    const previous = i > 0 ? Date.parse(list[i - 1].horaIso) : NaN;
    const step = Number.isFinite(next)
      ? next - slotStart
      : Number.isFinite(previous)
        ? slotStart - previous
        : 3_600_000;
    return slotStart < endMs && slotStart + step > startMs;
  };

  return (
    <section className="next-hours-section">
      <h3 className="section-kicker">{title}</h3>
      {hasHours && (
      <div
        className={`pd-hours-frame${moreBefore ? ' pd-hours-frame--before' : ''}${moreAfter ? ' pd-hours-frame--after' : ''}`}
      >
      <ul
        className="pd-hours"
        ref={scrollRef}
        onScroll={measureScroll}
        // A scrollable region must be reachable and named for the keyboard:
        // without tabindex its content is unreachable scrolling by keys.
        role="region"
        aria-label={title}
        tabIndex={0}
      >
        {list.map((h, i) => {
          const wet = (h.precipitacionMm ?? 0) > 0;
          return (
          /* Una frase por hora para quien no ve la tira: la nubosidad solo la
             cuenta el icono, y el icono es decorativo. */
          <li
            className={`pd-hour${inWindow(i) ? ' pd-hour--best' : ''}`}
            key={h.horaIso}
            aria-label={t(wet ? 'detalle.pronostico.ariaHoraLluvia' : 'detalle.pronostico.ariaHora', {
              hora: madridLocalHour(h.horaIso) ?? '--:--',
              nubes: h.nubesPct ?? '--',
              temp: h.temperaturaC != null ? Math.round(h.temperaturaC) : '--',
              viento: h.vientoMs != null ? Math.round(h.vientoMs) : '--',
            })}
          >
            <span className="pd-hour-clock" aria-hidden="true">
              {madridLocalHour(h.horaIso) ?? '--:--'}
            </span>
            {/* Rain replaces the cloud icon outright: a wet hour is what the
                window dodges, and a cloud there would hide the one fact that
                explains the recommendation. */}
            <IonIcon
              className={`pd-hour-icon${wet ? ' pd-hour-icon--rain' : ''}`}
              icon={wet ? rainyOutline : cloudIcon(h.nubesPct)}
              aria-hidden="true"
            />
            <span className="pd-hour-temp" aria-hidden="true">
              {h.temperaturaC != null ? `${Math.round(h.temperaturaC)}°` : '--'}
            </span>
            <span className="pd-hour-wind" aria-hidden="true">
              {h.vientoMs != null ? `${Math.round(h.vientoMs)} m/s` : '--'}
            </span>
          </li>
          );
        })}
      </ul>
      {moreBefore && (
        <button
          type="button"
          className="pd-hours-arrow pd-hours-arrow--before"
          aria-label={t('detalle.pronostico.horasAnteriores')}
          onClick={() => scroll(-1)}
        >
          <IonIcon icon={chevronBackOutline} aria-hidden="true" />
        </button>
      )}
      {moreAfter && (
        <button
          type="button"
          className="pd-hours-arrow pd-hours-arrow--after"
          aria-label={t('detalle.pronostico.horasSiguientes')}
          onClick={() => scroll(1)}
        >
          <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
        </button>
      )}
      </div>
      )}
      <BestTime timeWindow={timeWindow} detailed />
      {/* Quién lo pronostica, y qué hacemos con ello: estas mismas horas
          alimentan la puntuación, así que la licencia obliga a decir que los
          datos van adaptados. Esa nota ya acredita y enlaza la fuente, de modo
          que el crédito genérico solo sale cuando no hay nota — repetirlo
          sería decir dos veces lo mismo. The API sends no emission time for
          the outlook, so none is shown either way. */}
      {hasHours && (
        <DataInfo label="info.fuente" aria="info.aria.horas" className="next-hours-source">
          {sourceAttribution(source)?.note ? (
            <AttributionNote source={source} />
          ) : (
            <SourceAndFreshness provenance={hourlyForecastProvenance(source)} />
          )}
        </DataInfo>
      )}
    </section>
  );
};

export default NextHours;
