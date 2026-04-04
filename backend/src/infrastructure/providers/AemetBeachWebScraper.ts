import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { http } from '../http/axiosClient';
import { InMemoryCache } from '../cache/InMemoryCache';
import { debugLog } from '../utils/debug';
import type {
  BeachFullForecast,
  DayForecast,
  DayTides,
  HalfDayForecast,
} from '../../domain/entities/BeachForecast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRAPER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
};

const XML_TIMEOUT = 7000;
const HTML_TIMEOUT = 10000;
const CACHE_TTL = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Trim whitespace and non-breaking spaces (\u00a0). */
function clean(text: string | undefined | null): string | null {
  if (text == null) return null;
  const trimmed = text.replace(/\u00a0/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse a number from text, returning null on NaN. */
function safeInt(text: string | undefined | null): number | null {
  if (text == null) return null;
  const n = parseInt(text.replace(/\u00a0/g, '').trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function safeFloat(text: string | undefined | null): number | null {
  if (text == null) return null;
  const n = parseFloat(text.replace(/\u00a0/g, '').trim());
  return Number.isNaN(n) ? null : n;
}

function emptyHalf(): HalfDayForecast {
  return { skyDescription: null, skyIconCode: null, wind: null, waves: null };
}

// ---------------------------------------------------------------------------
// AemetBeachWebScraper
// ---------------------------------------------------------------------------

export class AemetBeachWebScraper {
  constructor(private readonly cache: InMemoryCache) {}

  async getBeachForecast(codigo: string): Promise<BeachFullForecast> {
    const cacheKey = `aemet:web:${codigo}`;
    return this.cache.getOrSet(cacheKey, CACHE_TTL, async () => {
      // 1. Try HTML first (has mareas, avisos, UV level)
      try {
        return await this.fetchAndParseHtml(codigo);
      } catch (htmlErr: any) {
        debugLog('aemet.web.html.fail', { codigo, error: htmlErr?.message });
      }
      // 2. Fallback XML (3 days but no mareas/avisos)
      return await this.fetchAndParseXml(codigo);
    });
  }

  // -----------------------------------------------------------------------
  // Fetch + decode
  // -----------------------------------------------------------------------

  private async fetchDecoded(url: string, timeout: number): Promise<string> {
    const resp = await http.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: SCRAPER_HEADERS,
    });
    let decoded = iconv.decode(Buffer.from(resp.data), 'iso-8859-15');
    // If we detect garbled UTF-8 markers, re-decode as utf-8
    if (decoded.includes('\u00c3\u00b1') || decoded.includes('\u00c3\u00b3')) {
      decoded = Buffer.from(resp.data).toString('utf-8');
    }
    return decoded;
  }

  // -----------------------------------------------------------------------
  // XML parser
  // -----------------------------------------------------------------------

  private async fetchAndParseXml(codigo: string): Promise<BeachFullForecast> {
    const url = `https://www.aemet.es/xml/playas/play_v2_${codigo}.xml`;
    const decoded = await this.fetchDecoded(url, XML_TIMEOUT);

    debugLog('aemet.web.xml.raw', decoded.slice(0, 3000));

    const $ = cheerio.load(decoded, { xmlMode: true });

    // Try multiple selectors for dia nodes
    let dias = $('prediccion > dia');
    if (dias.length === 0) dias = $('prediccion dia');
    if (dias.length === 0) throw new Error('XML: no <dia> nodes found');

    const days: DayForecast[] = [];
    const tides: DayTides[] = [];

    dias.each((_i, diaEl) => {
      const $dia = $(diaEl);
      const date = $dia.attr('fecha') ?? '';

      // Helper: find first matching child element from multiple tag names
      const findChild = (...names: string[]) => {
        for (const name of names) {
          const el = $dia.find(name).first();
          if (el.length > 0) return el;
        }
        return $();
      };

      const sky = findChild('estadoCielo', 'estado_cielo');
      const viento = findChild('viento');
      const oleaje = findChild('oleaje');
      const tMax = findChild('tMaxima', 'tmaxima', 't_maxima');
      const sTerm = findChild('sTermica', 'stermica', 's_termica');
      const tAgua = findChild('tAgua', 'tagua', 't_agua');
      const uvMax = findChild('uvMax', 'uv_max');

      const morning: HalfDayForecast = {
        skyDescription: clean(sky.attr('descripcion1')) ?? clean(sky.attr('valor1')),
        skyIconCode: safeInt(sky.attr('f1')),
        wind: clean(viento.attr('descripcion1')) ?? clean(viento.attr('valor1')),
        waves: clean(oleaje.attr('descripcion1')) ?? clean(oleaje.attr('valor1')),
      };

      const afternoon: HalfDayForecast = {
        skyDescription: clean(sky.attr('descripcion2')) ?? clean(sky.attr('valor2')),
        skyIconCode: safeInt(sky.attr('f2')),
        wind: clean(viento.attr('descripcion2')) ?? clean(viento.attr('valor2')),
        waves: clean(oleaje.attr('descripcion2')) ?? clean(oleaje.attr('valor2')),
      };

      const uvVal = safeInt(uvMax.attr('valor1') ?? uvMax.text());

      days.push({
        date,
        morning,
        afternoon,
        maxTemperatureC: safeFloat(tMax.attr('valor1') ?? tMax.text()),
        thermalSensation:
          clean(sTerm.attr('descripcion2')) ?? clean(sTerm.attr('descripcion1')) ?? clean(sTerm.text()),
        waterTemperatureC: safeFloat(tAgua.attr('valor1') ?? tAgua.text()),
        uvIndexMax: uvVal,
        uvLevel: clean(uvMax.attr('descripcion1')) ?? null,
        warning: null,
      });
    });

    // Tides: look for mareas > dia
    const mareasDias = $('mareas > dia, mareas dia');
    mareasDias.each((_i, mDia) => {
      const $m = $(mDia);
      const highTide: string[] = [];
      const lowTide: string[] = [];

      const pleamar = $m.find('pleamar').first();
      const bajamar = $m.find('bajamar').first();

      for (const attr of ['hora1', 'hora2']) {
        const h = clean(pleamar.attr(attr));
        if (h) highTide.push(h);
        const l = clean(bajamar.attr(attr));
        if (l) lowTide.push(l);
      }

      tides.push({ highTide, lowTide });
    });

    if (days.length === 0) throw new Error('XML: parsed 0 days');

    // Verify we have at least some non-null data
    const hasData = days.some(
      (d) =>
        d.morning.skyDescription !== null ||
        d.afternoon.skyDescription !== null ||
        d.maxTemperatureC !== null,
    );
    if (!hasData) throw new Error('XML: all fields are null');

    return {
      source: 'AEMET_XML',
      elaboration: null,
      warningZone: null,
      days,
      tides,
      tidesSource: null,
    };
  }

  // -----------------------------------------------------------------------
  // HTML parser
  // -----------------------------------------------------------------------

  private async fetchAndParseHtml(codigo: string): Promise<BeachFullForecast> {
    const url = `https://www.aemet.es/es/eltiempo/prediccion/playas?l=${codigo}`;
    const decoded = await this.fetchDecoded(url, HTML_TIMEOUT);

    debugLog('aemet.web.html.size', decoded.length);

    const $ = cheerio.load(decoded);

    // --- Prediction table ---
    const table = $('table.tabla_uv.tabla_web');

    // Parse day headers — each day th has colspan matching its half-day slots:
    //   colspan=2 → morning + afternoon (full day)
    //   colspan=1 → afternoon only (today, when morning has passed)
    // The first th in the row (no colspan or colspan=1 without a day name) is the row label — skip it.
    type DayHeader = { label: string; halfDaySlots: number };
    const dayHeaders: DayHeader[] = [];
    table.find('thead tr.cabecera_niv1 th').each((_i, th) => {
      const colspan = parseInt($(th).attr('colspan') ?? '1', 10);
      const text = clean($(th).text()) ?? '';
      // Day headers contain day names (lunes, martes, ..., domingo, or a number)
      const isDayHeader = /\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|\d{2})\b/i.test(text);
      if (isDayHeader && colspan >= 1) {
        dayHeaders.push({ label: text, halfDaySlots: colspan });
      }
    });
    const numDays = dayHeaders.length;

    debugLog('aemet.html.structure', {
      dayHeaders,
      numDays,
    });

    // Build a mapping: for each day, what is the starting cell index in half-day rows
    // and how many half-day cells it spans (1 = afternoon only, 2 = morning + afternoon)
    const daySlotOffsets: number[] = [];
    let cellOffset = 0;
    for (const dh of dayHeaders) {
      daySlotOffsets.push(cellOffset);
      cellOffset += dh.halfDaySlots;
    }

    // Body rows
    const rows = table.find('tbody tr').toArray();

    // Row 0: Sky state — variable cells per day (1 or 2)
    const skyCells = $(rows[0]).find('td').toArray();
    const skyData: HalfDayForecast[] = skyCells.map((td) => {
      const img = $(td).find('img').first();
      const src = img.attr('src') ?? '';
      const codeMatch = src.match(/(\d+)\.png/);
      return {
        skyDescription: clean(img.attr('title')),
        skyIconCode: codeMatch ? safeInt(codeMatch[1]) : null,
        wind: null,
        waves: null,
      };
    });

    // Row 1: Wind
    const windCells = $(rows[1]).find('td').toArray();
    const windTexts = windCells.map((td) => clean($(td).text()));

    // Row 2: Waves
    const wavesCells = $(rows[2]).find('td').toArray();
    const wavesTexts = wavesCells.map((td) => clean($(td).text()));

    // Merge wind/waves into skyData half-day slots
    for (let i = 0; i < skyData.length; i++) {
      skyData[i].wind = windTexts[i] ?? null;
      skyData[i].waves = wavesTexts[i] ?? null;
    }

    // Row 3: Max temperature (1 cell per day, variable colspan)
    const tempCells = $(rows[3]).find('td').toArray();
    const maxTemps = tempCells.map((td) => {
      const redDiv = $(td).find('div.texto_rojo').first();
      return safeInt(redDiv.length ? redDiv.text() : $(td).text());
    });

    // Row 4: Thermal sensation (1 cell per day)
    const sensCells = $(rows[4]).find('td').toArray();
    const sensations = sensCells.map((td) => clean($(td).text()));

    // Row 5: Water temperature (1 cell per day)
    const waterCells = $(rows[5]).find('td').toArray();
    const waterTemps = waterCells.map((td) => safeInt($(td).text()));

    // Row 6: UV index (1 cell per day)
    const uvCells = $(rows[6]).find('td').toArray();
    const uvData = uvCells.map((td) => {
      const span = $(td).find('span').first();
      const text = clean(span.length ? span.text() : $(td).text());
      const value = safeInt(text);
      const classes = (span.attr('class') ?? '').split(/\s+/);
      const levelClass = classes.find((c) => c.startsWith('raduv_pred_nivel'));
      const level = levelClass ? safeInt(levelClass.replace('raduv_pred_nivel', '')) : null;
      const description = clean(span.attr('title'));
      return { value, level, description };
    });

    // Row 7: Warnings (tr#tr_avisos) — may not exist
    const warningRow = table.find('tr#tr_avisos');
    let warningZone: string | null = null;
    const warningsPerDay: DayForecast['warning'][] = [];

    if (warningRow.length > 0) {
      warningZone = clean(warningRow.find('th').text()?.replace(/^Avisos\.\s*/i, ''));

      warningRow.find('td').each((_i, td) => {
        const div = $(td).find('div').first();
        if (div.length === 0) {
          warningsPerDay.push(null);
          return;
        }
        const divClasses = (div.attr('class') ?? '').split(/\s+/);
        const nivelClass = divClasses.find((c) => c.startsWith('aviso_nivel_'));
        const fenomenoClass = divClasses.find((c) => c.startsWith('aviso_fenomeno_'));
        warningsPerDay.push({
          level: nivelClass ? safeInt(nivelClass.replace('aviso_nivel_', '')) : null,
          description: clean(div.attr('title')),
          phenomenon: fenomenoClass ? fenomenoClass.replace('aviso_fenomeno_', '') : null,
        });
      });
    }

    // --- Assemble DayForecasts ---
    // Each day may have 1 slot (afternoon only) or 2 slots (morning + afternoon).
    const days: DayForecast[] = [];
    for (let d = 0; d < numDays; d++) {
      const offset = daySlotOffsets[d];
      const slots = dayHeaders[d].halfDaySlots;

      let morning: HalfDayForecast;
      let afternoon: HalfDayForecast;

      if (slots === 1) {
        // Afternoon only (today, morning has passed)
        morning = emptyHalf();
        afternoon = skyData[offset] ?? emptyHalf();
      } else {
        // Full day: morning + afternoon
        morning = skyData[offset] ?? emptyHalf();
        afternoon = skyData[offset + 1] ?? emptyHalf();
      }

      days.push({
        date: dayHeaders[d].label,
        morning,
        afternoon,
        maxTemperatureC: maxTemps[d] ?? null,
        thermalSensation: sensations[d] ?? null,
        waterTemperatureC: waterTemps[d] ?? null,
        uvIndexMax: uvData[d]?.value ?? null,
        uvLevel: uvData[d]?.description ?? null,
        warning: warningsPerDay[d] ?? null,
      });
    }

    // --- Tides table ---
    const tidesTable = $('table#tabla_mareas');
    const tidesResult: DayTides[] = [];
    let tidesSource: string | null = null;

    if (tidesTable.length > 0) {
      const tidesRows = tidesTable.find('tbody tr').toArray();
      const timeRegex = /(\d{1,2}:\d{2})/;

      // Row 0: High tides (6 cells → 2 per day)
      const highCells = $(tidesRows[0]).find('td').toArray();
      // Row 1: Low tides (6 cells)
      const lowCells = $(tidesRows[1]).find('td').toArray();

      for (let d = 0; d < numDays; d++) {
        const highTide: string[] = [];
        const lowTide: string[] = [];

        for (let slot = 0; slot < 2; slot++) {
          const idx = d * 2 + slot;

          const hText = $(highCells[idx]).text();
          const hMatch = hText.match(timeRegex);
          if (hMatch) highTide.push(hMatch[1]);

          const lText = $(lowCells[idx]).text();
          const lMatch = lText.match(timeRegex);
          if (lMatch) lowTide.push(lMatch[1]);
        }

        tidesResult.push({ highTide, lowTide });
      }

      tidesSource = clean(tidesTable.find('tfoot').text());
    }

    // --- Metadata ---
    // Extract elaboration date — look for text nodes after the "Elaboración" span
    let elaboration: string | null = null;
    $('span.font_bold').each((_i, span) => {
      const label = $(span).text();
      if (/elaboraci[oó]n/i.test(label)) {
        // Get the next sibling text node(s) directly after this span
        let next = $(span).get(0)?.nextSibling;
        while (next) {
          if (next.type === 'text') {
            const text = clean((next as any).data);
            if (text) {
              elaboration = text;
              return false; // break .each
            }
          }
          next = next.nextSibling;
        }
      }
    });

    return {
      source: 'AEMET_HTML',
      elaboration,
      warningZone,
      days,
      tides: tidesResult,
      tidesSource,
    };
  }
}
