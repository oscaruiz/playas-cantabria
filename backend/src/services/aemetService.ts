import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.AEMET_API_KEY!;
const BASE_URL = 'https://opendata.aemet.es/opendata/api';

export async function obtenerPrediccionPorCodigo(codigo: string): Promise<any> {
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

    const datosResponse = await axios.get(datosUrl, {
      responseType: 'text'
    });

    const raw = datosResponse.data;
    console.log('📄 Datos crudos:', typeof raw === 'string' ? raw.slice(0, 100) : raw);

    if (typeof raw === 'string' && raw.trim().startsWith('<!DOCTYPE html')) {
      throw new Error('La URL de datos devolvió HTML en lugar de JSON');
    }

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('La respuesta de AEMET no tiene datos');
    }

    return parsed[0]; // devolvemos el objeto único
  } catch (error: any) {
    console.error('❌ Error completo:', error);
    console.error(`❌ Mensaje de error: ${error.message}`);
    throw new Error('No se pudo obtener la predicción');
  }
}
