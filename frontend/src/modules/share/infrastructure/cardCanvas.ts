import type { FlagColor, CardSummary } from '../../../../../../../Dev/playas-cantabria/frontend/src/modules/share/domain/cardSummary';

/*
 * The card is drawn by hand on a canvas instead of photographing the DOM.
 * Two reasons, both hard: html2canvas costs ~48 kB gzip against a 185 kB
 * budget that is already at 153, and the sky icons come from aemet.es — a
 * cross-origin image taints the canvas and makes `toBlob()` throw. Drawing it
 * ourselves also means the image looks the same on every phone, and in dark
 * mode, which a screenshot of the page would not.
 */

const WIDTH = 1080;

/* The LIGHT palette, on purpose: the image is read by someone else, on another
   phone, and must not change with the sender's theme. Values copied from
   `theme/variables.css` — the light block. */
const DEEP_OCEAN = '#065a75';
const OCEAN = '#0a7ea4';
const PAPER = '#faf6f1';
const INK = '#1b2a32';
const SOFT_INK = '#51606c';
const BORDER = '#ddd8cc';

const FLAG_COLOR: Record<FlagColor, string> = {
  green: '#15803d',
  yellow: '#eab308',
  red: '#c2362f',
  black: '#1b2a32',
  unknown: '#9aa6ad',
};

/** Score bands, aligned with `ScoreBadge`: 60 recommends, 40 warns. */
function scoreColor(p: number): string {
  if (p >= 60) return '#15803d';
  if (p >= 40) return '#eab308';
  return '#c2362f';
}

const SANS = "'Poppins', system-ui, sans-serif";
const SERIF = "'Fraunces', Georgia, serif";
const BRAND = "'Pacifico', cursive";
const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

/* --- Layout. Named because they are read three times each: to measure, to
   place the next block, and to size the card around the result. --- */
const MARGIN = 60;
const FILL = 56;
const PX = MARGIN + FILL;
const PW = WIDTH - PX * 2;
const CY = 96;
const BADGE_W = 250;
const BADGE_H = 170;
const SUMMARY_LINE_HEIGHT = 48;
const WARNING_LINE_HEIGHT = 38;
/* Height each optional block adds, measured from its own hairline. */
const CELLS_HEIGHT = 148;
const HOURS_HEIGHT = 236;
const TIDES_HEIGHT = 154;
const PORT_HEIGHT = 36;

/**
 * The webfonts must be RESOLVED before the first `fillText`, not merely
 * declared: canvas does not re-draw when a font arrives late, so a card built
 * on a cold load came out in Times New Roman. Failing to load is not fatal —
 * the fallbacks in each stack are there for that.
 */
async function sourceList(): Promise<void> {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`700 66px ${SERIF}`),
      document.fonts.load(`600 38px ${SANS}`),
      document.fonts.load(`400 30px ${SANS}`),
      document.fonts.load(`400 46px ${BRAND}`),
    ]);
  } catch {
    /* the fallback stack takes over */
  }
}

/** `ctx.roundRect` is missing on iOS below 16, which is still out there. */
function roundRect(
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
function fittingSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  source: (px: number) => string,
  from: number,
  until: number,
): number {
  for (let px = from; px > until; px -= 2) {
    ctx.font = source(px);
    if (ctx.measureText(text).width <= width) return px;
  }
  return until;
}

/** Splits with the CURRENT font — set it before calling, or it measures another. */
function splitIntoLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width <= width || !current) {
      current = attempt;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) return lines;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  height: number,
): void {
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * height));
}

/** The chart hairlines of the app's headers, at the scale of the card. */
function cardLines(ctx: CanvasRenderingContext2D, height: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 3;
  for (let base = 70; base < height; base += 300) {
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 12) {
      const y = base + Math.sin((x / WIDTH) * Math.PI * 4 + base) * 16;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas sin imagen'))),
      'image/png',
    );
  });
}

/** Paints the summary and returns it as a PNG ready to be shared. */
export async function cardAsPng(summary: CardSummary): Promise<Blob> {
  await sourceList();

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
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
  const summaryLines = splitIntoLines(ctx, summary.summary, rw, 3);
  ctx.font = `400 27px ${SANS}`;
  const warningLines = splitIntoLines(ctx, summary.warning, PW, 4);

  const yBadge = CY + 226;
  const blockEnd = Math.max(
    yBadge + BADGE_H,
    yBadge + 128 + (summaryLines.length - 1) * SUMMARY_LINE_HEIGHT,
  );
  // Each block starts at its own hairline and the next one starts where it
  // ends, so a beach with no hourly outlook or no tide table simply has a
  // shorter card instead of a gap where the section would have been.
  const yCells = blockEnd + 70;
  const yHours = yCells + CELLS_HEIGHT;
  const yTides = yHours + (summary.hours.length ? HOURS_HEIGHT : 0);
  const yWarningSep =
    yTides +
    (summary.tides.length ? TIDES_HEIGHT + (summary.tidePort ? PORT_HEIGHT : 0) : 0);
  const yWarning = yWarningSep + 56;
  const cardEnd = yWarning + (warningLines.length - 1) * WARNING_LINE_HEIGHT + 52;
  const cardHeight = cardEnd - CY;
  const HEIGHT = cardEnd + 210;

  // Resizing clears the canvas and resets the context: everything below
  // re-declares its own font and fill.
  canvas.height = HEIGHT;

  // --- Ocean background, the same gradient as the app's headers ---
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, DEEP_OCEAN);
  background.addColorStop(1, OCEAN);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  cardLines(ctx, HEIGHT);

  // --- Paper card ---
  ctx.fillStyle = PAPER;
  roundRect(ctx, MARGIN, CY, WIDTH - MARGIN * 2, cardHeight, 44);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';

  // --- Beach and when ---
  ctx.fillStyle = INK;
  ctx.font = `700 ${fittingSize(ctx, summary.name, PW, (s) => `700 ${s}px ${SERIF}`, 68, 40)}px ${SERIF}`;
  ctx.fillText(summary.name, PX, CY + 130, PW);

  ctx.fillStyle = SOFT_INK;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillText(summary.context, PX, CY + 180, PW);

  // --- Score, and what the day looks like ---
  const color = scoreColor(summary.score);
  ctx.fillStyle = `${color}1f`;
  roundRect(ctx, PX, yBadge, BADGE_W, BADGE_H, 40);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  roundRect(ctx, PX, yBadge, BADGE_W, BADGE_H, 40);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.font = `700 92px ${SERIF}`;
  ctx.fillText(String(summary.score), PX + BADGE_W / 2, yBadge + 100);
  ctx.font = `600 30px ${SANS}`;
  ctx.fillText('/100', PX + BADGE_W / 2, yBadge + 142);
  ctx.textAlign = 'left';

  ctx.font = `54px ${EMOJI}`;
  ctx.fillText(summary.emoji, rx, yBadge + 62);
  ctx.fillStyle = INK;
  ctx.font = `600 38px ${SANS}`;
  drawLines(ctx, summaryLines, rx, yBadge + 128, SUMMARY_LINE_HEIGHT);

  /** The hairline that opens every block below the summary. */
  const hairline = (y: number) => {
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PX, y);
    ctx.lineTo(PX + PW, y);
    ctx.stroke();
  };

  /** Block heading, in the same voice as the page's section kickers. */
  const caption = (text: string, y: number) => {
    ctx.fillStyle = SOFT_INK;
    ctx.font = `600 24px ${SANS}`;
    ctx.fillText(text.toUpperCase(), PX, y);
  };

  // --- Wind, waves and (only when one is flying) the flag ---
  hairline(yCells);
  const cellWidth = PW / summary.cells.length;
  summary.cells.forEach((cell, i) => {
    const x = PX + i * cellWidth;
    // Not `rotulo`: that one is for block headings, which always start at the
    // card's left padding. These sit at the head of their own column.
    ctx.fillStyle = SOFT_INK;
    ctx.font = `600 24px ${SANS}`;
    ctx.fillText(cell.label.toUpperCase(), x, yCells + 56);

    let vx = x;
    if (cell.flag) {
      ctx.fillStyle = FLAG_COLOR[cell.flag];
      ctx.beginPath();
      ctx.arc(x + 11, yCells + 92, 11, 0, Math.PI * 2);
      ctx.fill();
      vx = x + 34;
    }
    ctx.fillStyle = INK;
    const available = cellWidth - (vx - x) - 20;
    ctx.font = `600 ${fittingSize(ctx, cell.value, available, (s) => `600 ${s}px ${SANS}`, 34, 20)}px ${SANS}`;
    ctx.fillText(cell.value, vx, yCells + 102, available);
  });

  // --- The next few hours: "and if I go later?" ---
  if (summary.hours.length) {
    hairline(yHours);
    caption(summary.hoursTitle, yHours + 52);
    const hourWidth = PW / summary.hours.length;
    summary.hours.forEach((hour, i) => {
      const x = PX + i * hourWidth;
      ctx.fillStyle = SOFT_INK;
      ctx.font = `600 26px ${SANS}`;
      ctx.fillText(hour.hour, x, yHours + 100);
      ctx.font = `32px ${EMOJI}`;
      ctx.fillText(hour.emoji, x, yHours + 146);
      ctx.fillStyle = INK;
      ctx.font = `700 34px ${SERIF}`;
      ctx.fillText(hour.temperature, x, yHours + 192);
      ctx.fillStyle = SOFT_INK;
      ctx.font = `400 22px ${SANS}`;
      ctx.fillText(hour.wind, x, yHours + 224);
    });
  }

  // --- Tides ---
  if (summary.tides.length) {
    hairline(yTides);
    caption(summary.tidesTitle, yTides + 52);
    const tideWidth = PW / summary.tides.length;
    summary.tides.forEach((tide, i) => {
      const x = PX + i * tideWidth;
      ctx.fillStyle = INK;
      ctx.font = `600 32px ${SANS}`;
      ctx.fillText(`${tide.arrow} ${tide.hour}`, x, yTides + 104, tideWidth - 16);
      ctx.fillStyle = SOFT_INK;
      ctx.font = `400 23px ${SANS}`;
      ctx.fillText(tide.label, x, yTides + 140, tideWidth - 16);
    });
    if (summary.tidePort) {
      ctx.fillStyle = SOFT_INK;
      ctx.font = `400 22px ${SANS}`;
      ctx.fillText(summary.tidePort, PX, yTides + 178, PW);
    }
  }

  hairline(yWarningSep);

  // --- The disclaimer travels WITH the image: it is the part that stops a
  //     forwarded card from being read as a promise about the sea. ---
  ctx.fillStyle = SOFT_INK;
  ctx.font = `400 27px ${SANS}`;
  drawLines(ctx, warningLines, PX, yWarning, WARNING_LINE_HEIGHT);

  // --- Brand, under the card and over the ocean ---
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = `400 46px ${BRAND}`;
  ctx.fillText(summary.brand, WIDTH / 2, cardEnd + 86, PW);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `400 28px ${SANS}`;
  ctx.fillText(summary.site, WIDTH / 2, cardEnd + 134, PW);

  return toBlob(canvas);
}
