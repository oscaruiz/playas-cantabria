// src/services/aemetService.ts
import axios from 'axios';
import dotenv from 'dotenv';
import { cache } from '../utils/cacheInstance';

dotenv.config();

const API_KEY = process.env.AEMET_API_KEY!;
const BASE_URL = 'https://opendata.aemet.es/opendata/api';

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

    const { data } = await axios.get(url);
    console.log('📥 Respuesta AEMET 1:', data);

    if (!data || !data.datos) {
      console.error('⚠️ No se recibió URL de datos');
      throw new Error('No se recibió URL de datos desde AEMET');
    }

    const datosUrl = data.datos;
    console.log('🔗 URL de datos JSON:', datosUrl);

    const datosResponse = await axios.get(datosUrl, { responseType: 'text' });
    const raw = datosResponse.data;

    if (typeof raw === 'string' && raw.trim().startsWith('<!DOCTYPE html')) {
      throw new Error('La URL de datos devolvió HTML en lugar de JSON');
    }

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('La respuesta de AEMET no tiene datos');
    }

    const resultado = parsed[0];
    cache.set(cacheKey, resultado);

    return {
      ...resultado,
      ultimaActualizacion: new Date().toISOString(),
    };

  } catch (error: any) {
    console.error('❌ Error completo:', error);
    console.error(`❌ Mensaje de error: ${error.message}`);
    throw new Error('No se pudo obtener la predicción');
  }
}
