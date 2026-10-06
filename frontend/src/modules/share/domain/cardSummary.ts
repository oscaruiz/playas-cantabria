import type { FeaturedBeach, HourlyForecast } from '../../../services/api';
import type { Language, TranslateFn } from '../../../shared/i18n/LanguageContext';
import {
  translateApiText,
  readableReason,
  windLevelKey,
  noForecastFragment,
} from '../../../shared/i18n/apiText';
import { skyEmoji, isNightAt, flagColorClass } from '../../../utils/beachHelpers';
import { capitalize } from '../../../shared/format/text';
import { madridLocalHour } from '../../../shared/format/time';
import { formatShortDate, dayName } from '../../../shared/i18n/dates';

/** Flag band, as a name — the hex lives in the layer that paints. */
export type FlagColor = 'green' | 'yellow' | 'red' | 'black' | 'unknown';

export interface CardCell {
  label: string;
  value: string;
  /** Only the flag cell carries a colour swatch. */
  flag?: FlagColor;
}

export interface CardHour {
  hour: string;
  emoji: string;
  temperature: string;
  wind: string;
}

export interface CardTide {
  arrow: string;
  label: string;
  hour: string;
}

/** Everything the card says, already translated and ready to be painted. */
export interface CardSummary {
  name: string;
  context: string;
  score: number;
  emoji: string;
  summary: string;
  cells: CardCell[];
  hoursTitle: string;
  hours: CardHour[];
  tidesTitle: string;
  tides: CardTide[];
  /** Reference port of the tide times. Without it the times mean nothing. */
  tidePort: string | null;
  warning: string;
  brand: string;
  site: string;
}

export interface CardInput {
  beach: { nombre: string; municipio: string };
  scored: FeaturedBeach;
  /** Region brand and site, injected: the domain does not read configuration. */
  brand: string;
  site: string;
  /**
   * Today's wind and waves as the forecast panel paints them (raw Spanish from
   * the API). This is the PREFERRED source, not a fallback: it is the reading
   * the page shows in large type, and the image travels alone, with nobody
   * able to check it against anything. The ranking's own values are the
   * fallback — they answer "why this score", which is a different question,
   * and they round differently: 2.9 m/s scores as "no wind" while the same
   * moment is forecast as "light", and the card was printing BOTH, one in the
   * cell and one in the summary line right above it.
   */
  forecast?: { wind?: string | null; waves?: string | null };
  hours?: HourlyForecast[] | null;
  tides?: { pleamar: string[]; bajamar: string[] } | null;
  tidePort?: string | null;
  now: Date;
  t: TranslateFn;
  language: Language;
}

/** Cloud cover → sky glyph. Same three states as `iconoDeNubes` on the page. */
function cloudEmoji(pct: number | null): string {
  if (pct == null) return '⛅';
  if (pct <= 25) return '☀️';
  if (pct <= 50) return '⛅';
  return '☁️';
}

/** "6:05" and "16:05" both sort right; plain string order would not. */
function minutesOfDayOf(hour: string): number {
  const [h, m] = hour.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * The reading of the day, exactly as the score card paints it on screen. An
 * image that says something different from the page it came from would be the
 * worst possible bug here: it travels on its own, with no way to check it
 * against the app.
 */
export function cardSummary({
  beach,
  scored,
  brand,
  site,
  forecast,
  hours,
  tides,
  tidePort,
  now,
  t,
  language,
}: CardInput): CardSummary {
  // Same trim as the score card: with an outlook, the reason drops the
  // fragment that repeats it, or the card would say it twice.
  const rationale = scored.pronostico
    ? noForecastFragment(scored.razonRanking)
    : scored.razonRanking;

  const noData = capitalize(t('detalle.scoreInfo.sinDato'));
  /** Backend Spanish → the cell's text, or nothing if there is none. */
  const fromApi = (text?: string | null): string | null =>
    text ? capitalize(translateApiText(text, language)) : null;

  const cells: CardCell[] = [
    {
      label: t('detalle.viento'),
      value:
        fromApi(forecast?.wind) ??
        (scored.vientoMs != null
          ? capitalize(t(windLevelKey(scored.vientoMs)))
          : noData),
    },
    {
      label: t('detalle.oleaje'),
      value: fromApi(forecast?.waves) ?? fromApi(scored.oleaje) ?? noData,
    },
  ];

  // No flag: no cell. On a beach nobody watches there is nothing to report,
  // and a cell saying so read as a failure — the two that remain simply take
  // the width. Printed only when a flag is actually flying.
  if (scored.bandera) {
    cells.push({
      label: t('detalle.bandera'),
      value: capitalize(translateApiText(scored.bandera, language)),
      flag: flagColorClass(scored.bandera) as FlagColor,
    });
  }

  return {
    name: beach.nombre,
    context: `${beach.municipio} · ${formatShortDate(
      capitalize(dayName(now.getDay(), language)),
      now.getDate(),
      now.getMonth(),
      language,
    )}`,
    score: Math.round(scored.puntuacion),
    emoji: skyEmoji(scored.descripcionClima, isNightAt(scored)),
    summary: capitalize(translateApiText(readableReason(rationale), language)),
    cells,
    hoursTitle: t('detalle.pronostico.titulo'),
    // Four, like the section it comes from: the strip answers "and if I go
    // later?", and a longer tail turns it into a forecast nobody asked for.
    hours: (hours ?? []).slice(0, 4).map((h) => ({
      hour: madridLocalHour(h.horaIso) ?? '--:--',
      emoji: cloudEmoji(h.nubesPct),
      temperature: h.temperaturaC != null ? `${Math.round(h.temperaturaC)}°` : '--',
      wind: h.vientoMs != null ? `${Math.round(h.vientoMs)} m/s` : '--',
    })),
    tidesTitle: t('detalle.mareas'),
    tides: [
      ...(tides?.pleamar ?? []).map((hour) => ({
        arrow: '↑',
        label: t('marea.pleamar'),
        hour,
      })),
      ...(tides?.bajamar ?? []).map((hour) => ({
        arrow: '↓',
        label: t('marea.bajamar'),
        hour,
      })),
    ].sort((a, b) => minutesOfDayOf(a.hour) - minutesOfDayOf(b.hour)),
    // AEMET annotates the port with a leading asterisk; it is a footnote mark
    // in their table and means nothing here.
    tidePort: tidePort ? tidePort.replace(/^\*/, '') : null,
    warning: t('aviso.ranking'),
    brand,
    site,
  };
}
