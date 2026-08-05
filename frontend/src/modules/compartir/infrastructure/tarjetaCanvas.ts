import type { ColorBandera, ResumenTarjeta } from '../domain/resumenTarjeta';

/*
 * The card is drawn by hand on a canvas instead of photographing the DOM.
 * Two reasons, both hard: html2canvas costs ~48 kB gzip against a 185 kB
 * budget that is already at 153, and the sky icons come from aemet.es — a
 * cross-origin image taints the canvas and makes `toBlob()` throw. Drawing it
 * ourselves also means the image looks the same on every phone, and in dark
 * mode, which a screenshot of the page would not.
 */

const ANCHO = 1080;

/* The LIGHT palette, on purpose: the image is read by someone else, on another
   phone, and must not change with the sender's theme. Values copied from
   `theme/variables.css` — the light block. */
const OCEANO_HONDO = '#065a75';
const OCEANO = '#0a7ea4';
const PAPEL = '#faf6f1';
const TINTA = '#1b2a32';
const TINTA_SUAVE = '#51606c';
const BORDE = '#ddd8cc';

const COLOR_BANDERA: Record<ColorBandera, string> = {
  green: '#15803d',
  yellow: '#eab308',
  red: '#c2362f',
  black: '#1b2a32',
  unknown: '#9aa6ad',
};

/** Score bands, aligned with `ScoreBadge`: 60 recommends, 40 warns. */
function colorPuntuacion(p: number): string {
  if (p >= 60) return '#15803d';
  if (p >= 40) return '#eab308';
  return '#c2362f';
}

const SANS = "'Poppins', system-ui, sans-serif";
const SERIF = "'Fraunces', Georgia, serif";
const MARCA = "'Pacifico', cursive";
const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

/* --- Layout. Named because they are read three times each: to measure, to
   place the next block, and to size the card around the result. --- */
const MARGEN = 60;
const RELLENO = 56;
const PX = MARGEN + RELLENO;
const PW = ANCHO - PX * 2;
const CY = 96;
const BADGE_W = 250;
const BADGE_H = 170;
const ALTO_LINEA_RESUMEN = 48;
const ALTO_LINEA_AVISO = 38;
/* Height each optional block adds, measured from its own hairline. */
const ALTO_CELDAS = 148;
const ALTO_HORAS = 236;
const ALTO_MAREAS = 154;
const ALTO_PUERTO = 36;

/**
 * The webfonts must be RESOLVED before the first `fillText`, not merely
 * declared: canvas does not re-draw when a font arrives late, so a card built
 * on a cold load came out in Times New Roman. Failing to load is not fatal —
 * the fallbacks in each stack are there for that.
 */
async function fuentesListas(): Promise<void> {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`700 66px ${SERIF}`),
      document.fonts.load(`600 38px ${SANS}`),
      document.fonts.load(`400 30px ${SANS}`),
      document.fonts.load(`400 46px ${MARCA}`),
    ]);
  } catch {
    /* the fallback stack takes over */
  }
}

/** `ctx.roundRect` is missing on iOS below 16, which is still out there. */
function rectRedondo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Largest size at which the text still fits, down to a floor. */
function tamanoQueCabe(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
  fuente: (px: number) => string,
  desde: number,
  hasta: number,
): number {
  for (let px = desde; px > hasta; px -= 2) {
    ctx.font = fuente(px);
    if (ctx.measureText(texto).width <= ancho) return px;
  }
  return hasta;
}

/** Splits with the CURRENT font — set it before calling, or it measures another. */
function partirEnLineas(
  ctx: CanvasRenderingContext2D,
  texto: string,
  ancho: number,
  maxLineas: number,
): string[] {
  const lineas: string[] = [];
  let actual = '';

  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const intento = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(intento).width <= ancho || !actual) {
      actual = intento;
    } else {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas) return lineas;
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);
  return lineas;
}

function pintarLineas(
  ctx: CanvasRenderingContext2D,
  lineas: string[],
  x: number,
  y: number,
  alto: number,
): void {
  lineas.forEach((linea, i) => ctx.fillText(linea, x, y + i * alto));
}

/** The chart hairlines of the app's headers, at the scale of the card. */
function lineasDeCarta(ctx: CanvasRenderingContext2D, alto: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 3;
  for (let base = 70; base < alto; base += 300) {
    ctx.beginPath();
    for (let x = 0; x <= ANCHO; x += 12) {
      const y = base + Math.sin((x / ANCHO) * Math.PI * 4 + base) * 16;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function aBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas sin imagen'))),
      'image/png',
    );
  });
}

/** Paints the summary and returns it as a PNG ready to be shared. */
export async function tarjetaComoPng(resumen: ResumenTarjeta): Promise<Blob> {
  await fuentesListas();

  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = 10;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('sin contexto 2d');

  /* --- Measure first, then size. The card used to be a fixed 1020px tall and
     a short summary left a third of it empty, while a long one would have run
     past the edge. Wrapping is what decides the height, so it is resolved
     before anything is painted. --- */
  const rx = PX + BADGE_W + 44;
  const rw = PW - BADGE_W - 44;
  ctx.font = `600 38px ${SANS}`;
  const lineasResumen = partirEnLineas(ctx, resumen.resumen, rw, 3);
  ctx.font = `400 27px ${SANS}`;
  const lineasAviso = partirEnLineas(ctx, resumen.aviso, PW, 4);

  const yBadge = CY + 226;
  const finBloque = Math.max(
    yBadge + BADGE_H,
    yBadge + 128 + (lineasResumen.length - 1) * ALTO_LINEA_RESUMEN,
  );
  // Each block starts at its own hairline and the next one starts where it
  // ends, so a beach with no hourly outlook or no tide table simply has a
  // shorter card instead of a gap where the section would have been.
  const yCeldas = finBloque + 70;
  const yHoras = yCeldas + ALTO_CELDAS;
  const yMareas = yHoras + (resumen.horas.length ? ALTO_HORAS : 0);
  const yAvisoSep =
    yMareas +
    (resumen.mareas.length ? ALTO_MAREAS + (resumen.puertoMareas ? ALTO_PUERTO : 0) : 0);
  const yAviso = yAvisoSep + 56;
  const finTarjeta = yAviso + (lineasAviso.length - 1) * ALTO_LINEA_AVISO + 52;
  const alturaTarjeta = finTarjeta - CY;
  const ALTO = finTarjeta + 210;

  // Resizing clears the canvas and resets the context: everything below
  // re-declares its own font and fill.
  canvas.height = ALTO;

  // --- Ocean background, the same gradient as the app's headers ---
  const fondo = ctx.createLinearGradient(0, 0, 0, ALTO);
  fondo.addColorStop(0, OCEANO_HONDO);
  fondo.addColorStop(1, OCEANO);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  lineasDeCarta(ctx, ALTO);

  // --- Paper card ---
  ctx.fillStyle = PAPEL;
  rectRedondo(ctx, MARGEN, CY, ANCHO - MARGEN * 2, alturaTarjeta, 44);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';

  // --- Beach and when ---
  ctx.fillStyle = TINTA;
  ctx.font = `700 ${tamanoQueCabe(ctx, resumen.nombre, PW, (s) => `700 ${s}px ${SERIF}`, 68, 40)}px ${SERIF}`;
  ctx.fillText(resumen.nombre, PX, CY + 130, PW);

  ctx.fillStyle = TINTA_SUAVE;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText(resumen.contexto, PX, CY + 180, PW);

  // --- Score, and what the day looks like ---
  const color = colorPuntuacion(resumen.puntuacion);
  ctx.fillStyle = `${color}1f`;
  rectRedondo(ctx, PX, yBadge, BADGE_W, BADGE_H, 40);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  rectRedondo(ctx, PX, yBadge, BADGE_W, BADGE_H, 40);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.font = `700 92px ${SERIF}`;
  ctx.fillText(String(resumen.puntuacion), PX + BADGE_W / 2, yBadge + 100);
  ctx.font = `600 30px ${SANS}`;
  ctx.fillText('/100', PX + BADGE_W / 2, yBadge + 142);
  ctx.textAlign = 'left';

  ctx.font = `54px ${EMOJI}`;
  ctx.fillText(resumen.emoji, rx, yBadge + 62);
  ctx.fillStyle = TINTA;
  ctx.font = `600 38px ${SANS}`;
  pintarLineas(ctx, lineasResumen, rx, yBadge + 128, ALTO_LINEA_RESUMEN);

  /** The hairline that opens every block below the summary. */
  const hairline = (y: number) => {
    ctx.strokeStyle = BORDE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PX, y);
    ctx.lineTo(PX + PW, y);
    ctx.stroke();
  };

  /** Block heading, in the same voice as the page's section kickers. */
  const rotulo = (texto: string, y: number) => {
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `600 24px ${SANS}`;
    ctx.fillText(texto.toUpperCase(), PX, y);
  };

  // --- Wind, waves and (only when one is flying) the flag ---
  hairline(yCeldas);
  const anchoCelda = PW / resumen.celdas.length;
  resumen.celdas.forEach((celda, i) => {
    const x = PX + i * anchoCelda;
    // Not `rotulo`: that one is for block headings, which always start at the
    // card's left padding. These sit at the head of their own column.
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = `600 24px ${SANS}`;
    ctx.fillText(celda.etiqueta.toUpperCase(), x, yCeldas + 56);

    let vx = x;
    if (celda.bandera) {
      ctx.fillStyle = COLOR_BANDERA[celda.bandera];
      ctx.beginPath();
      ctx.arc(x + 11, yCeldas + 92, 11, 0, Math.PI * 2);
      ctx.fill();
      vx = x + 34;
    }
    ctx.fillStyle = TINTA;
    const disponible = anchoCelda - (vx - x) - 20;
    ctx.font = `600 ${tamanoQueCabe(ctx, celda.valor, disponible, (s) => `600 ${s}px ${SANS}`, 34, 20)}px ${SANS}`;
    ctx.fillText(celda.valor, vx, yCeldas + 102, disponible);
  });

  // --- The next few hours: "and if I go later?" ---
  if (resumen.horas.length) {
    hairline(yHoras);
    rotulo(resumen.tituloHoras, yHoras + 52);
    const anchoHora = PW / resumen.horas.length;
    resumen.horas.forEach((hora, i) => {
      const x = PX + i * anchoHora;
      ctx.fillStyle = TINTA_SUAVE;
      ctx.font = `600 26px ${SANS}`;
      ctx.fillText(hora.hora, x, yHoras + 100);
      ctx.font = `32px ${EMOJI}`;
      ctx.fillText(hora.emoji, x, yHoras + 146);
      ctx.fillStyle = TINTA;
      ctx.font = `700 34px ${SERIF}`;
      ctx.fillText(hora.temperatura, x, yHoras + 192);
      ctx.fillStyle = TINTA_SUAVE;
      ctx.font = `400 22px ${SANS}`;
      ctx.fillText(hora.viento, x, yHoras + 224);
    });
  }

  // --- Tides ---
  if (resumen.mareas.length) {
    hairline(yMareas);
    rotulo(resumen.tituloMareas, yMareas + 52);
    const anchoMarea = PW / resumen.mareas.length;
    resumen.mareas.forEach((marea, i) => {
      const x = PX + i * anchoMarea;
      ctx.fillStyle = TINTA;
      ctx.font = `600 32px ${SANS}`;
      ctx.fillText(`${marea.flecha} ${marea.hora}`, x, yMareas + 104, anchoMarea - 16);
      ctx.fillStyle = TINTA_SUAVE;
      ctx.font = `400 23px ${SANS}`;
      ctx.fillText(marea.etiqueta, x, yMareas + 140, anchoMarea - 16);
    });
    if (resumen.puertoMareas) {
      ctx.fillStyle = TINTA_SUAVE;
      ctx.font = `400 22px ${SANS}`;
      ctx.fillText(resumen.puertoMareas, PX, yMareas + 178, PW);
    }
  }

  hairline(yAvisoSep);

  // --- The disclaimer travels WITH the image: it is the part that stops a
  //     forwarded card from being read as a promise about the sea. ---
  ctx.fillStyle = TINTA_SUAVE;
  ctx.font = `400 27px ${SANS}`;
  pintarLineas(ctx, lineasAviso, PX, yAviso, ALTO_LINEA_AVISO);

  // --- Brand, under the card and over the ocean ---
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `400 46px ${MARCA}`;
  ctx.fillText(resumen.marca, ANCHO / 2, finTarjeta + 86, PW);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `400 28px ${SANS}`;
  ctx.fillText(resumen.sitio, ANCHO / 2, finTarjeta + 134, PW);

  return aBlob(canvas);
}
