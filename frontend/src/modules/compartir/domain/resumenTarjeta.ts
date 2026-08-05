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
  etiqueta: string;
  valor: string;
  /** Only the flag cell carries a colour swatch. */
  bandera?: ColorBandera;
}

export interface HoraTarjeta {
  hora: string;
  emoji: string;
  temperatura: string;
  viento: string;
}

export interface MareaTarjeta {
  flecha: string;
  etiqueta: string;
  hora: string;
}

/** Everything the card says, already translated and ready to be painted. */
export interface ResumenTarjeta {
  nombre: string;
  contexto: string;
  puntuacion: number;
  emoji: string;
  resumen: string;
  celdas: CeldaTarjeta[];
  tituloHoras: string;
  horas: HoraTarjeta[];
  tituloMareas: string;
  mareas: MareaTarjeta[];
  /** Reference port of the tide times. Without it the times mean nothing. */
  puertoMareas: string | null;
  aviso: string;
  marca: string;
  sitio: string;
}

export interface EntradaTarjeta {
  playa: { nombre: string; municipio: string };
  puntuada: FeaturedBeach;
  /** Region brand and site, injected: the domain does not read configuration. */
  marca: string;
  sitio: string;
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
  prevision?: { viento?: string | null; oleaje?: string | null };
  horas?: PrevisionHora[] | null;
  mareas?: { pleamar: string[]; bajamar: string[] } | null;
  puertoMareas?: string | null;
  ahora: Date;
  t: TraducirFn;
  idioma: Idioma;
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
  playa,
  puntuada,
  marca,
  sitio,
  prevision,
  horas,
  mareas,
  puertoMareas,
  ahora,
  t,
  idioma,
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
      etiqueta: t('detalle.viento'),
      valor:
        deLaApi(prevision?.viento) ??
        (puntuada.vientoMs != null
          ? capitalizar(t(claveNivelVientoMs(puntuada.vientoMs)))
          : sinDato),
    },
    {
      etiqueta: t('detalle.oleaje'),
      valor: deLaApi(prevision?.oleaje) ?? deLaApi(puntuada.oleaje) ?? sinDato,
    },
  ];

  // No flag: no cell. On a beach nobody watches there is nothing to report,
  // and a cell saying so read as a failure — the two that remain simply take
  // the width. Printed only when a flag is actually flying.
  if (puntuada.bandera) {
    celdas.push({
      etiqueta: t('detalle.bandera'),
      valor: capitalizar(traducirTextoApi(puntuada.bandera, idioma)),
      bandera: flagColorClass(puntuada.bandera) as ColorBandera,
    });
  }

  return {
    nombre: playa.nombre,
    contexto: `${playa.municipio} · ${formatearFechaCorta(
      capitalizar(nombreDia(ahora.getDay(), idioma)),
      ahora.getDate(),
      ahora.getMonth(),
      idioma,
    )}`,
    puntuacion: Math.round(puntuada.puntuacion),
    emoji: emojiCielo(puntuada.descripcionClima, esNocheEn(puntuada)),
    resumen: capitalizar(traducirTextoApi(razonLegible(razon), idioma)),
    celdas,
    tituloHoras: t('detalle.pronostico.titulo'),
    // Four, like the section it comes from: the strip answers "and if I go
    // later?", and a longer tail turns it into a forecast nobody asked for.
    horas: (horas ?? []).slice(0, 4).map((h) => ({
      hora: horaLocalMadrid(h.horaIso) ?? '--:--',
      emoji: emojiDeNubes(h.nubesPct),
      temperatura: h.temperaturaC != null ? `${Math.round(h.temperaturaC)}°` : '--',
      viento: h.vientoMs != null ? `${Math.round(h.vientoMs)} m/s` : '--',
    })),
    tituloMareas: t('detalle.mareas'),
    mareas: [
      ...(mareas?.pleamar ?? []).map((hora) => ({
        flecha: '↑',
        etiqueta: t('marea.pleamar'),
        hora,
      })),
      ...(mareas?.bajamar ?? []).map((hora) => ({
        flecha: '↓',
        etiqueta: t('marea.bajamar'),
        hora,
      })),
    ].sort((a, b) => minutosDelDia(a.hora) - minutosDelDia(b.hora)),
    // AEMET annotates the port with a leading asterisk; it is a footnote mark
    // in their table and means nothing here.
    puertoMareas: puertoMareas ? puertoMareas.replace(/^\*/, '') : null,
    aviso: t('aviso.ranking'),
    marca,
    sitio,
  };
}
