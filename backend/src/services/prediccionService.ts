// src/services/prediccionService.ts
import axios from 'axios';
import dotenv from 'dotenv';
import { cache } from '../utils/cacheInstance';
import playas from '../data/playasCantabria.json';

dotenv.config();

const AEMET_API_KEY = process.env.AEMET_API_KEY!;
const OWM_API_KEY = process.env.OPENWEATHER_API_KEY!;
const BASE_AEMET = 'https://opendata.aemet.es/opendata/api';

if (!OWM_API_KEY) {
  throw new Error('❌ Falta la variable OPENWEATHER_API_KEY en el .env');
}

type Playa = {
  codigo: string;
  nombre: string;
  municipio: string;
  lat: number;
  lon: number;
  idCruzRoja: number;
};

function getCoordenadasPorCodigo(codigo: string): { lat: number, lon: number } | null {
  const playa = (playas as Playa[]).find(p => p.codigo === codigo);
  return playa ? { lat: playa.lat, lon: playa.lon } : null;
}

async function fetchAemetPrediccion(codigo: string): Promise<any> {
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

  console.log(`✅ [AEMET] Predicción obtenida con éxito para código ${codigo}`);

  return {
    fuente: 'AEMET',
    prediccion: parsed[0],
    ultimaActualizacion: new Date().toISOString()
  };
}

async function fetchOpenWeatherFallback(codigo: string): Promise<any> {
  console.log(`🌥️ [OWM] Usando OpenWeatherMap como alternativa para código ${codigo}`);

  const coords = getCoordenadasPorCodigo(codigo);
  if (!coords) throw new Error(`No se conocen coordenadas para código ${codigo}`);

  const { lat, lon } = coords;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=es&appid=${OWM_API_KEY}`;

  const res = await axios.get(url, { timeout: 8000 });

  console.log(`✅ [OWM] Predicción obtenida desde OpenWeatherMap para código ${codigo}`);

  return {
    fuente: 'OpenWeatherMap',
    prediccion: {
      resumen: res.data.weather?.[0]?.description || 'Sin descripción',
      temperatura: res.data.main.temp,
      humedad: res.data.main.humidity,
      viento: res.data.wind.speed,
      icono: res.data.weather?.[0]?.icon,
      datosCrudos: res.data
    },
    ultimaActualizacion: new Date().toISOString()
  };
}

export async function obtenerPrediccionConFallback(codigo: string): Promise<any> {
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
    const isRedError = msg.includes('socket hang up') || msg.includes('timeout') || msg.includes('ECONNRESET') || msg.includes('getaddrinfo') || msg.includes('ENOTFOUND');

    if (isRedError || err.response?.status === 429 || err.response?.status === 500) {
      console.warn(`⚠️ [FALLBACK] AEMET falló (${msg}). Usando OpenWeatherMap...`);
      const fallback = await fetchOpenWeatherFallback(codigo);
      cache.set(cacheKey, fallback);
      return fallback;
    } else {
      console.error('❌ [ERROR] Fallo no recuperable al consultar AEMET:', err);
      throw new Error(`Error consultando AEMET: ${msg}`);
    }
  }
}
