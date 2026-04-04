import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { AemetBeachWebScraper } from '../infrastructure/providers/AemetBeachWebScraper';
import type { BeachFullForecast, DayForecast } from '../domain/entities/BeachForecast';

const BEACHES = [
  { codigo: '3902401', nombre: 'Comillas' },
  { codigo: '3907506', nombre: 'Sardinero' },
  { codigo: '3903502', nombre: 'La Salve' },
];

function summarizeDay(day: DayForecast): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (day.date) fields.fecha = day.date;
  if (day.morning.skyDescription) fields['mañana.cielo'] = day.morning.skyDescription;
  if (day.morning.skyIconCode != null) fields['mañana.icono'] = day.morning.skyIconCode;
  if (day.morning.wind) fields['mañana.viento'] = day.morning.wind;
  if (day.morning.waves) fields['mañana.oleaje'] = day.morning.waves;
  if (day.afternoon.skyDescription) fields['tarde.cielo'] = day.afternoon.skyDescription;
  if (day.maxTemperatureC != null) fields.tempMax = day.maxTemperatureC;
  if (day.thermalSensation) fields.sensacion = day.thermalSensation;
  if (day.waterTemperatureC != null) fields.tempAgua = day.waterTemperatureC;
  if (day.uvIndexMax != null) fields.uvMax = day.uvIndexMax;
  if (day.uvLevel) fields.uvNivel = day.uvLevel;
  if (day.warning) fields.aviso = day.warning;
  return fields;
}

function printResult(nombre: string, codigo: string, forecast: BeachFullForecast) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ ${nombre} (${codigo})`);
  console.log(`   Fuente: ${forecast.source}`);
  console.log(`   Días: ${forecast.days.length}`);
  console.log(`   Mareas: ${forecast.tides.length > 0 ? `${forecast.tides.length} días` : 'NO'}`);
  if (forecast.elaboration) console.log(`   Elaboración: ${forecast.elaboration}`);
  if (forecast.warningZone) console.log(`   Zona avisos: ${forecast.warningZone}`);
  if (forecast.tidesSource) console.log(`   Fuente mareas: ${forecast.tidesSource}`);

  if (forecast.days.length > 0) {
    console.log(`   Día 0:`, JSON.stringify(summarizeDay(forecast.days[0]), null, 2));
  }

  if (forecast.tides.length > 0) {
    const t = forecast.tides[0];
    console.log(`   Mareas día 0: pleamar=[${t.highTide.join(', ')}] bajamar=[${t.lowTide.join(', ')}]`);
  }
}

async function main() {
  console.log('🏖️  Test AemetBeachWebScraper');
  console.log(`   DEBUG_WEATHER=${process.env.DEBUG_WEATHER ?? '0'}`);

  const cache = new InMemoryCache();
  const scraper = new AemetBeachWebScraper(cache);

  for (const { codigo, nombre } of BEACHES) {
    try {
      const forecast = await scraper.getBeachForecast(codigo);
      printResult(nombre, codigo, forecast);
    } catch (err: any) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`❌ ${nombre} (${codigo}): ${err?.message ?? err}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
