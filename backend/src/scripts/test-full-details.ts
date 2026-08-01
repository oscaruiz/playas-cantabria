import dotenv from 'dotenv';
dotenv.config();
process.env.DEBUG_WEATHER = '1';

import fs from 'fs';
import { createContainer } from '../infrastructure/di';
import { LegacyDetailsAssembler } from '../application/services/LegacyDetailsAssembler';
import { AemetBeachWebScraper } from '../infrastructure/providers/AemetBeachWebScraper';
import { AemetBeachForecastProvider } from '../infrastructure/providers/AemetBeachForecastProvider';
import { GetBeachDetails } from '../domain/use-cases/GetBeachDetails';
import type { LegacyDetailsDTO } from '../application/mappers/LegacyDetailsMapper';
import type { BeachFullForecast } from '../domain/entities/BeachForecast';
import { resolveScriptRegion } from './scriptRegion';

const region = resolveScriptRegion();

// Load all beaches from data file
const allBeaches = JSON.parse(
  fs.readFileSync(region.catalogPath, 'utf-8'),
) as Array<{ nombre: string; codigo: string; idCruzRoja: number }>;

const SEP = '═'.repeat(55);

type BeachResult = {
  nombre: string;
  codigo: string;
  ok: boolean;
  error?: string;
  fuente: string | null;
  dias: number;
  mareas: boolean;
  avisos: boolean;
  uv: number | null;
  tempAgua: number | null;
  tempAguaReal: boolean;
  cruzRoja: string | null;
  idCruzRoja: number;
};

function printDiagnostic(
  nombre: string,
  codigo: string,
  result: LegacyDetailsDTO,
  scraperResult: BeachFullForecast | null,
  scraperError: string | null,
  aemetApiError: string | null,
  owResult: any | null,
  owError: string | null,
) {
  const clima = result.clima;
  const pred = result.prediccionCompleta;
  const cr = result.cruzRoja;

  console.log(SEP);
  console.log(`DIAGNÓSTICO: ${nombre} (${codigo})`);
  console.log(SEP);

  console.log('CLIMA:');
  console.log(`· fuente: ${clima?.fuente ?? 'null'}  summary: ${clima?.hoy.summary ? `"${clima.hoy.summary}"` : 'null'}  temp: ${clima?.hoy.temperature != null ? `${clima.hoy.temperature}°C` : 'null'}  agua: ${clima?.hoy.waterTemperature != null ? `${clima.hoy.waterTemperature}°C` : 'null'}${clima?.hoy.waterTemperature === 22 ? ' (fallback)' : ''}  UV: ${clima?.hoy.uvIndex ?? 'null'}  viento: ${clima?.hoy.wind ?? 'null'}  oleaje: ${clima?.hoy.waves ?? 'null'}`);

  console.log('PREDICCION COMPLETA:');
  if (!pred) {
    console.log('· NO DISPONIBLE');
  } else {
    console.log(`· fuente: ${pred.fuente}  días: ${pred.dias.length}  mareas: ${pred.mareas.length > 0 ? 'SI' : 'NO'}  avisos: ${pred.dias.some(d => d.aviso) ? 'SI' : 'NO'}  zona: ${pred.zonaAvisos ?? 'null'}`);
    if (pred.dias[0]) {
      const d = pred.dias[0];
      console.log(`· día0: tarde="${d.tarde.cielo}" tempMax=${d.temperaturaMaxima} agua=${d.temperaturaAgua} UV=${d.indiceUV} (${d.nivelUV}) aviso="${d.aviso?.descripcion ?? 'null'}"`);
    }
  }

  console.log('CRUZ ROJA:');
  console.log(`· bandera: ${cr?.bandera ?? 'null'}  horario: ${cr?.horario ?? 'null'}`);

  console.log('FALLBACKS:');
  console.log(`· scraper: ${scraperResult ? 'OK' : `FALLO (${scraperError})`}  AEMET API: ${scraperResult ? 'skip' : aemetApiError ? `FALLO (${aemetApiError})` : 'OK'}  OW: ${owResult ? 'OK' : owError ? `FALLO (${owError})` : 'null'}  CR: ${cr ? 'OK' : 'NO'}`);
  console.log(SEP);
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function printSummaryTable(results: BeachResult[]) {
  const okCount = results.filter(r => r.ok).length;
  const mareasCount = results.filter(r => r.mareas).length;
  const avisosCount = results.filter(r => r.avisos).length;
  const uvCount = results.filter(r => r.uv != null).length;
  const aguaRealCount = results.filter(r => r.tempAguaReal).length;
  const crCount = results.filter(r => r.cruzRoja && r.cruzRoja !== 'null').length;

  console.log('\n╔══════════════════════════════════╦═════════╦══════╦════════╦════════╦═══════╦═══════════════╦═════════════╗');
  console.log('║ Playa                            ║ Fuente  ║ Días ║ Mareas ║ Avisos ║ UV    ║ Temp Agua     ║ Cruz Roja   ║');
  console.log('╠══════════════════════════════════╬═════════╬══════╬════════╬════════╬═══════╬═══════════════╬═════════════╣');

  for (const r of results) {
    if (!r.ok) {
      console.log(`║ ${pad(`❌ ${r.nombre}`, 32)} ║ ${pad('ERROR', 7)} ║ ${pad('-', 4)} ║ ${pad('-', 6)} ║ ${pad('-', 6)} ║ ${pad('-', 5)} ║ ${pad('-', 13)} ║ ${pad('-', 11)} ║`);
      continue;
    }
    const fuente = pad(r.fuente?.replace('AEMET_', '') ?? '-', 7);
    const dias = pad(String(r.dias), 4);
    const mareas = pad(r.mareas ? '✅' : '❌', 6);
    const avisos = pad(r.avisos ? '✅' : '❌', 6);
    const uv = pad(r.uv != null ? String(r.uv) : '-', 5);
    const agua = pad(
      r.tempAgua != null ? `${r.tempAgua}°C (${r.tempAguaReal ? 'real' : 'fback'})` : '-',
      13,
    );
    const cr = pad(r.cruzRoja ?? '-', 11);
    console.log(`║ ${pad(r.nombre, 32)} ║ ${fuente} ║ ${dias} ║ ${mareas} ║ ${avisos} ║ ${uv} ║ ${agua} ║ ${cr} ║`);
  }

  console.log('╠══════════════════════════════════╬═════════╬══════╬════════╬════════╬═══════╬═══════════════╬═════════════╣');
  console.log(`║ ${pad(`TOTAL: ${okCount}/${results.length} OK`, 32)} ║         ║      ║ ${pad(`${mareasCount}/${results.length}`, 6)} ║ ${pad(`${avisosCount}/${results.length}`, 6)} ║ ${pad(`${uvCount}/${results.length}`, 5)} ║ ${pad(`${aguaRealCount}/${results.length} real`, 13)} ║ ${pad(`${crCount}/${results.length}`, 11)} ║`);
  console.log('╚══════════════════════════════════╩═════════╩══════╩════════╩════════╩═══════╩═══════════════╩═════════════╝');
}

async function main() {
  console.log('🏖️  Test Full Details — Todas las playas\n');
  console.log(`AEMET_API_KEY: ${process.env.AEMET_API_KEY ? '✅' : '❌'}`);
  console.log(`OPENWEATHER_API_KEY: ${process.env.OPENWEATHER_API_KEY ? '✅' : '❌'}`);
  console.log(`Playas a testear: ${allBeaches.length}\n`);

  const container = createContainer({ region });
  const results: BeachResult[] = [];

  for (let i = 0; i < allBeaches.length; i++) {
    const { codigo, nombre, idCruzRoja } = allBeaches[i];

    if (i > 0) {
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n[${i + 1}/${allBeaches.length}] ${nombre} (${codigo})`);

    let scraperResult: BeachFullForecast | null = null;
    let scraperError: string | null = null;
    let aemetApiError: string | null = null;
    let owResult: any = null;
    let owError: string | null = null;

    try {
      // Individual scraper test
      try {
        const scraper = container.get<AemetBeachWebScraper>('aemetBeachWebScraper');
        scraperResult = await scraper.getBeachForecast(codigo);
      } catch (e: any) {
        scraperError = e?.message || String(e);
      }

      // Individual AEMET API test
      try {
        const aemetPlayas = container.get<AemetBeachForecastProvider>('aemetBeachForecastProvider');
        await aemetPlayas.getByBeachCode(codigo);
      } catch (e: any) {
        aemetApiError = e?.message || String(e);
      }

      // Weather from use-case
      try {
        const getDetails = container.get<GetBeachDetails>('getBeachDetails');
        const details = await getDetails.execute(codigo);
        owResult = details.weather;
      } catch (e: any) {
        owError = e?.message || String(e);
      }

      // Full assembler
      const assembler = container.get<LegacyDetailsAssembler>('legacyDetailsAssembler');
      const result = await assembler.assemble(codigo);

      printDiagnostic(nombre, codigo, result, scraperResult, scraperError, aemetApiError, owResult, owError);

      const pred = result.prediccionCompleta;
      const agua = result.clima?.hoy.waterTemperature ?? null;

      results.push({
        nombre,
        codigo,
        ok: true,
        fuente: pred?.fuente ?? result.clima?.fuente ?? null,
        dias: pred?.dias.length ?? 0,
        mareas: (pred?.mareas.length ?? 0) > 0,
        avisos: pred?.dias.some(d => d.aviso) ?? false,
        uv: result.clima?.hoy.uvIndex ?? null,
        tempAgua: agua,
        tempAguaReal: agua !== null && agua !== 22,
        cruzRoja: result.cruzRoja?.bandera ?? null,
        idCruzRoja,
      });
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.log(`❌ FALLO TOTAL: ${msg}`);
      results.push({
        nombre,
        codigo,
        ok: false,
        error: msg,
        fuente: null,
        dias: 0,
        mareas: false,
        avisos: false,
        uv: null,
        tempAgua: null,
        tempAguaReal: false,
        cruzRoja: null,
        idCruzRoja,
      });
    }
  }

  printSummaryTable(results);
  console.log('\n✅ Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
