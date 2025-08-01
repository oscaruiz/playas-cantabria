import axios from 'axios';
import dotenv from 'dotenv';
import { cache } from '../utils/cacheInstance';

dotenv.config();

const API_KEY = process.env.AEMET_API_KEY!;
const BASE_URL = 'https://opendata.aemet.es/opendata/api';

async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      return response;
    } catch (error: any) {
      const isLast = i === retries;
      console.warn(`⚠️ Error al intentar obtener ${url} (intento ${i + 1}): ${error.message}`);
      if (isLast) throw error;
      await new Promise(res => setTimeout(res, delay * (i + 1))); // backoff lineal
    }
  }
}

export async function obtenerPrediccionPorCodigo(codigo: string): Promise<any> {
  const cacheKey = `aemet-${codigo}`;
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    console.log(`✅ [CACHE] AEMET ${codigo}`);
    return {
      ...cached.value,
      ultimaActualizacion: cached.updatedAt.toISOString(),
    };
  }

  try {
    const url = `${BASE_URL}/prediccion/especifica/playa/${codigo}?api_key=${API_KEY}`;
    console.log('🔗 URL AEMET 1:', url);

    const { data } = await fetchWithRetry(url);
    console.log('📥 Respuesta AEMET 1:', data);

    if (!data || !data.datos) {
      console.error('⚠️ No se recibió URL de datos');
      throw new Error(`No se recibió URL de datos desde AEMET para código ${codigo}`);
    }

    const datosUrl = data.datos;
    console.log('🔗 URL de datos JSON:', datosUrl);

    const datosResponse = await fetchWithRetry(datosUrl);
    const raw = datosResponse.data;

    if (
      typeof raw === 'string' &&
      (raw.trim().startsWith('<!DOCTYPE html') || raw.includes('<html'))
    ) {
      throw new Error(`La URL de datos devolvió HTML en lugar de JSON para código ${codigo}`);
    }

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`La respuesta de AEMET no tiene datos para código ${codigo}`);
    }

    const resultado = parsed[0];
    cache.set(cacheKey, resultado);

    return {
      ...resultado,
      ultimaActualizacion: new Date().toISOString(),
    };

  } catch (error: any) {
    console.error('❌ Error completo:', error);
    throw new Error(`No se pudo obtener la predicción para código ${codigo}: ${error.message}`);
  }
}
