import { Weather } from '../entities/Weather';
import { PrecipitationNow } from '../entities/RainNowcast';

/**
 * The skies that can stand in for OpenWeather's current weather, in the same
 * shape it has: a Spanish description in OpenWeather's own words and an
 * OpenWeather-style icon (`02d`), so the sky corrector, the scorer and the
 * interface treat them exactly alike.
 *
 * The order is OpenWeather → Open-Meteo → AEMET's forecast, labelled
 * `previsto` → no sky at all. What it replaces was AEMET's station reading
 * with a sky made up from temperature and humidity ("Templado y húmedo",
 * cloudy above 80 %): a sky nobody had seen, in the place where the app says
 * what the sky is now (10-oct-2026).
 */

type Sky = { description: string; icon: string };

/** WMO weather code (Open-Meteo `weather_code`) → OpenWeather's wording and icon. */
function skyFromWmo(code: number): Sky | null {
  if (code === 0) return { description: 'cielo claro', icon: '01' };
  if (code === 1) return { description: 'algo de nubes', icon: '02' };
  if (code === 2) return { description: 'nubes dispersas', icon: '03' };
  if (code === 3) return { description: 'nubes', icon: '04' };
  if (code === 45 || code === 48) return { description: 'niebla', icon: '50' };
  if (code >= 51 && code <= 57) return { description: 'llovizna', icon: '09' };
  if (code === 61) return { description: 'lluvia ligera', icon: '10' };
  if (code === 63) return { description: 'lluvia moderada', icon: '10' };
  if (code === 65 || code === 66 || code === 67) return { description: 'lluvia intensa', icon: '10' };
  if (code >= 71 && code <= 77) return { description: 'nieve', icon: '13' };
  if (code >= 80 && code <= 82) return { description: 'chubascos', icon: '09' };
  if (code === 85 || code === 86) return { description: 'chubascos de nieve', icon: '13' };
  if (code >= 95 && code <= 99) return { description: 'tormenta', icon: '11' };
  return null;
}

/**
 * Open-Meteo's current reading as a `Weather`, or null when it carries no
 * recognisable sky: a reading with no sky is no stand-in for one.
 */
export function weatherFromOpenMeteo(now: PrecipitationNow): Weather | null {
  const sky = now.weatherCode == null ? null : skyFromWmo(now.weatherCode);
  if (!sky) return null;
  const c = now.current;
  return {
    source: 'Open-Meteo',
    timestamp: now.timestamp,
    temperatureC: c?.temperatureC ?? null,
    description: sky.description,
    icon: `${sky.icon}${c?.isDay === false ? 'n' : 'd'}`,
    precipitationMm: now.precipitationMm,
    conditionCode: null,
    cloudinessPct: c?.cloudCoverPct ?? null,
    windSpeedMs: c?.windSpeedMs ?? null,
    windDirectionDeg: c?.windDirectionDeg ?? null,
    humidityPct: c?.humidityPct ?? null,
    pressureHPa: null,
  };
}

/** AEMET's forecast wording ("Muy nuboso con lluvia") → an OpenWeather-style icon. */
function iconFromForecastText(text: string): string | null {
  const s = text.toLowerCase();
  if (/tormenta/.test(s)) return '11';
  if (/nieve|nevada|aguanieve/.test(s)) return '13';
  if (/chubasc|llovizna/.test(s)) return '09';
  if (/lluvia/.test(s)) return '10';
  if (/niebla|bruma|neblina/.test(s)) return '50';
  if (/cubierto|muy nuboso/.test(s)) return '04';
  if (/poco nuboso|intervalos/.test(s)) return '02';
  if (/nuboso|nubes/.test(s)) return '03';
  if (/despejado|soleado/.test(s)) return '01';
  return null;
}

/**
 * AEMET's station reading with the sky of today's beach forecast, labelled as
 * forecast; with no forecast, with no sky at all. The temperature and the
 * wind are real readings and stay.
 */
export function withForecastSky(observation: Weather, forecastText: string | null | undefined): Weather {
  const text = forecastText?.trim();
  const icon = text ? iconFromForecastText(text) : null;
  if (!text || !icon) return { ...observation, description: null, icon: null };
  return { ...observation, description: text, icon: `${icon}d`, previsto: true };
}

/**
 * The sky described for NOW (OpenWeather, or Open-Meteo standing in), never
 * a forecast. AEMET never qualifies: a station measures no sky, so whatever
 * sky an AEMET reading carries is the forecast or nothing.
 */
export function observedSky(weather: Weather | null | undefined): string | null {
  if (!weather || weather.source === 'AEMET' || weather.previsto) return null;
  return weather.description;
}
