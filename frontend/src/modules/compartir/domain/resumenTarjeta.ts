import type { FeaturedBeach, PrevisionHora } from '../../../services/api';
import type { Idioma, TraducirFn } from '../../../shared/i18n/IdiomaContext';
import {
  traducirTextoApi,
  razonLegible,
  claveNivelVientoMs,
  sinFragmentoDePronostico,
} from '../../../shared/i18n/apiText';
import { emojiCielo, esNocheEn, flagColorClass } from '../../../utils/beachHelpers';
import { capitalizar } from '../../../shared/format/texto';
import { horaLocalMadrid } from '../../../shared/format/tiempo';
import { formatearFechaCorta, nombreDia } from '../../../shared/i18n/fechas';

/** Flag band, as a name — the hex lives in the layer that paints. */
export type ColorBandera = 'green' | 'yellow' | 'red' | 'black' | 'unknown';

export interface CeldaTarjeta {
  label: string;
  value: string;
  /** Only the flag cell carries a colour swatch. */
  flag?: ColorBandera;
}

export interface HoraTarjeta {
  hour: string;
  emoji: string;
  temperature: string;
  wind: string;
}

export interface MareaTarjeta {
  arrow: string;
  label: string;
  hour: string;
}

/** Everything the card says, already translated and ready to be painted. */
export interface ResumenTarjeta {
  name: string;
  context: string;
  score: number;
  emoji: string;
  summary: string;
  cells: CeldaTarjeta[];
  hoursTitle: string;
  hours: HoraTarjeta[];
  tidesTitle: string;
  tides: MareaTarjeta[];
  /** Reference port of the tide times. Without it the times mean nothing. */
  tidePort: string | null;
  warning: string;
  brand: string;
  site: string;
}

export interface EntradaTarjeta {
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
  hours?: PrevisionHora[] | null;
  tides?: { pleamar: string[]; bajamar: string[] } | null;
  tidePort?: string | null;
  now: Date;
  t: TraducirFn;
  language: Idioma;
}

/** Cloud cover → sky glyph. Same three states as `iconoDeNubes` on the page. */
function emojiDeNubes(pct: number | null): string {
  if (pct == null) return '⛅';
  if (pct <= 25) return '☀️';
  if (pct <= 50) return '⛅';
  return '☁️';
}

/** "6:05" and "16:05" both sort right; plain string order would not. */
function minutosDelDia(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * The reading of the day, exactly as the score card paints it on screen. An
 * image that says something different from the page it came from would be the
 * worst possible bug here: it travels on its own, with no way to check it
 * against the app.
 */
export function resumenTarjeta({
  beach: playa,
  scored: puntuada,
  brand: marca,
  site: sitio,
  forecast: prevision,
  hours: horas,
  tides: mareas,
  tidePort: puertoMareas,
  now: ahora,
  t,
  language: idioma,
}: EntradaTarjeta): ResumenTarjeta {
  // Same trim as the score card: with an outlook, the reason drops the
  // fragment that repeats it, or the card would say it twice.
  const razon = puntuada.pronostico
    ? sinFragmentoDePronostico(puntuada.razonRanking)
    : puntuada.razonRanking;

  const sinDato = capitalizar(t('detalle.scoreInfo.sinDato'));
  /** Backend Spanish → the cell's text, or nothing if there is none. */
  const deLaApi = (texto?: string | null): string | null =>
    texto ? capitalizar(traducirTextoApi(texto, idioma)) : null;

  const celdas: CeldaTarjeta[] = [
    {
      label: t('detalle.viento'),
      value:
        deLaApi(prevision?.wind) ??
        (puntuada.vientoMs != null
          ? capitalizar(t(claveNivelVientoMs(puntuada.vientoMs)))
          : sinDato),
    },
    {
      label: t('detalle.oleaje'),
      value: deLaApi(prevision?.waves) ?? deLaApi(puntuada.oleaje) ?? sinDato,
    },
  ];

  // No flag: no cell. On a beach nobody watches there is nothing to report,
  // and a cell saying so read as a failure — the two that remain simply take
  // the width. Printed only when a flag is actually flying.
  if (puntuada.bandera) {
    celdas.push({
      label: t('detalle.bandera'),
      value: capitalizar(traducirTextoApi(puntuada.bandera, idioma)),
      flag: flagColorClass(puntuada.bandera) as ColorBandera,
    });
  }

  return {
    name: playa.nombre,
    context: `${playa.municipio} · ${formatearFechaCorta(
      capitalizar(nombreDia(ahora.getDay(), idioma)),
      ahora.getDate(),
      ahora.getMonth(),
      idioma,
    )}`,
    score: Math.round(puntuada.puntuacion),
    emoji: emojiCielo(puntuada.descripcionClima, esNocheEn(puntuada)),
    summary: capitalizar(traducirTextoApi(razonLegible(razon), idioma)),
    cells: celdas,
    hoursTitle: t('detalle.pronostico.titulo'),
    // Four, like the section it comes from: the strip answers "and if I go
    // later?", and a longer tail turns it into a forecast nobody asked for.
    hours: (horas ?? []).slice(0, 4).map((h) => ({
      hour: horaLocalMadrid(h.horaIso) ?? '--:--',
      emoji: emojiDeNubes(h.nubesPct),
      temperature: h.temperaturaC != null ? `${Math.round(h.temperaturaC)}°` : '--',
      wind: h.vientoMs != null ? `${Math.round(h.vientoMs)} m/s` : '--',
    })),
    tidesTitle: t('detalle.mareas'),
    tides: [
      ...(mareas?.pleamar ?? []).map((hora) => ({
        arrow: '↑',
        label: t('marea.pleamar'),
        hour: hora,
      })),
      ...(mareas?.bajamar ?? []).map((hora) => ({
        arrow: '↓',
        label: t('marea.bajamar'),
        hour: hora,
      })),
    ].sort((a, b) => minutosDelDia(a.hour) - minutosDelDia(b.hour)),
    // AEMET annotates the port with a leading asterisk; it is a footnote mark
    // in their table and means nothing here.
    tidePort: puertoMareas ? puertoMareas.replace(/^\*/, '') : null,
    warning: t('aviso.ranking'),
    brand: marca,
    site: sitio,
  };
}
