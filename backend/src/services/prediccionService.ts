// src/services/prediccionService.ts
import axios from 'axios';
import dotenv from 'dotenv';
import { cache } from '../utils/cacheInstance';
import playasJson from '../data/playasCantabria.json';
import { Beach } from '../core/types/Beach';
import { StandardWeather, WeatherSource, DailyForecast } from '../core/types/Weather';

const playas: Beach[] = playasJson as Beach[];

dotenv.config();

const AEMET_API_KEY = process.env.AEMET_API_KEY!;
const OWM_API_KEY = process.env.OPENWEATHER_API_KEY!;
const BASE_AEMET = 'https://opendata.aemet.es/opendata/api';

if (!OWM_API_KEY) {
  throw new Error('❌ Falta la variable OPENWEATHER_API_KEY en el .env');
}


function getCoordenadasPorCodigo(codigo: string): { lat: number, lon: number } | null {
  // Extraer el código base si es un código modificado (e.g., "3908503_TEST" -> "3908503")
  const codigoBase = codigo.split('_')[0];
  const playa = (playas as Beach[]).find(p => p.codigo === codigoBase);
  return playa ? { lat: playa.lat, lon: playa.lon } : null;
}

async function fetchAemetPrediccion(codigo: string): Promise<StandardWeather> {
  console.log(`🌤️ [AEMET] Solicitando predicción para código ${codigo}...`);

  const url = `${BASE_AEMET}/prediccion/especifica/playa/${codigo}?api_key=${AEMET_API_KEY}`;
  const res1 = await axios.get(url, { timeout: 2000 });

  const datosUrl = res1.data?.datos;
  console.log(`🔗 [AEMET] URL de datos: ${datosUrl}`);
  if (!datosUrl) throw new Error('No se recibió URL de datos');

  const res2 = await axios.get(datosUrl, { timeout: 2000 });
  const raw = res2.data;

  if (typeof raw === 'string' && (raw.includes('<html') || raw.startsWith('<!DOCTYPE'))) {
    throw new Error('La URL de datos devolvió HTML en lugar de JSON');
  }

  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Respuesta vacía de AEMET');
  }

  console.log('📊 [AEMET] Estructura de datos recibida:', JSON.stringify(parsed[0], null, 2));
  console.log(`✅ [AEMET] Predicción obtenida con éxito para código ${codigo}`);

  const aemetData = parsed[0];
  
  function extractDailyForecast(dia: any): DailyForecast {
    // Extraer descripción del estado del cielo (prioriza f2 sobre f1)
    const skyDescription = dia?.estadoCielo?.descripcion2 || dia?.estadoCielo?.descripcion1 || 'Sin datos';
    
    // Extraer temperatura máxima
    const temp = dia?.tmaxima?.valor1 ?? dia?.tMaxima?.valor1 ?? null;
    
    // Extraer sensación térmica
    const sensation = dia?.stermica?.descripcion1 ?? dia?.sTermica?.descripcion1 ?? null;

    // Extraer descripción del viento
    const windDesc = dia?.viento?.descripcion2 || dia?.viento?.descripcion1 || 'Sin datos';

    // Extraer descripción del oleaje
    const waveDesc = dia?.oleaje?.descripcion2 || dia?.oleaje?.descripcion1 || 'Sin datos';

    // Temperatura del agua
    const waterTemp = dia?.tagua?.valor1 ?? dia?.tAgua?.valor1 ?? null;

    // Índice UV máximo
    const uvIndex = dia?.uvMax?.valor1 ?? null;

    return {
      summary: skyDescription,
      temperature: temp,
      waterTemperature: waterTemp,
      sensation: sensation,
      wind: windDesc,
      waves: waveDesc,
      uvIndex: uvIndex,
      icon: dia?.estadoCielo?.f2 || dia?.estadoCielo?.f1 || null
    };
  }

  // Verificar que existan los datos necesarios
  if (!aemetData?.prediccion?.dia || !Array.isArray(aemetData.prediccion.dia)) {
    throw new Error('Estructura de datos de AEMET inválida');
  }

  const today: DailyForecast = extractDailyForecast(aemetData.prediccion.dia[0]);
  const tomorrow: DailyForecast = aemetData.prediccion.dia.length > 1 
    ? extractDailyForecast(aemetData.prediccion.dia[1])
    : today;

  return {
    source: 'AEMET',
    lastUpdated: new Date().toISOString(),
    forecast: {
      today,
      tomorrow
    }
  };
}

async function fetchOpenWeatherFallback(codigo: string): Promise<StandardWeather> {
  console.log(`🌥️ [OWM] Usando OpenWeatherMap como alternativa para código ${codigo}`);

  const coords = getCoordenadasPorCodigo(codigo);
  if (!coords) throw new Error(`No se conocen coordenadas para código ${codigo}`);

  const { lat, lon } = coords;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${OWM_API_KEY}`;

  const res = await axios.get(url, { timeout: 8000 });

  console.log(`✅ [OWM] Predicción obtenida desde OpenWeatherMap para código ${codigo}`);

  const weatherData = res.data;
  // Función auxiliar para determinar el estado del mar basado en el viento
  const getWaveStatus = (windSpeed: number): string => {
    if (windSpeed > 20) return 'agitado';
    if (windSpeed > 10) return 'moderado';
    return 'tranquilo';
  };

  const forecast: DailyForecast = {
    summary: weatherData.weather?.[0]?.description || 'Sin descripción',
    temperature: Math.round(weatherData.main.temp * 10) / 10, // Redondear a 1 decimal
    waterTemperature: 22, // Temperatura media del mar Cantábrico en verano
    sensation: weatherData.main.feels_like 
      ? `${Math.round(weatherData.main.feels_like)}°C (${
          weatherData.main.feels_like > 25 ? 'caluroso' :
          weatherData.main.feels_like > 20 ? 'agradable' :
          weatherData.main.feels_like > 15 ? 'fresco' : 'frío'
        })`
      : undefined,
    wind: `${
      weatherData.wind.speed > 20 ? 'fuerte' :
      weatherData.wind.speed > 10 ? 'moderado' : 'flojo'
    } (${Math.round(weatherData.wind.speed * 3.6)} km/h)`, // Convertir m/s a km/h
    waves: getWaveStatus(weatherData.wind.speed),
    uvIndex: weatherData.clouds?.all 
      ? Math.max(1, Math.round(10 * (1 - weatherData.clouds.all / 100))) // Estimación basada en nubosidad
      : undefined,
    icon: weatherData.weather?.[0]?.icon
  };

  return {
    source: 'OpenWeatherMap',
    lastUpdated: new Date().toISOString(),
    forecast: {
      today: forecast,
      tomorrow: forecast // OpenWeather free API no provee predicción para mañana
    }
  };
}

export async function obtenerPrediccionConFallback(codigo: string): Promise<StandardWeather> {
  const cacheKey = `prediccion-${codigo}`;
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    console.log(`✅ [CACHE] Respuesta cacheada para código ${codigo}`);
    return cached.value;
  }

  try {
    const datos = await fetchAemetPrediccion(codigo);
    cache.set(cacheKey, datos);
    return datos;
  } catch (err: any) {
    const msg = err.message || '';
    console.warn(`⚠️ [FALLBACK] AEMET falló (${msg}). Usando OpenWeatherMap...`);
    const fallback = await fetchOpenWeatherFallback(codigo);
    cache.set(cacheKey, fallback);
    return fallback;
  }
}
