// src/services/cruzRojaService.ts
import axios from 'axios';
import qs from 'qs';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { cache } from '../utils/cacheInstance';

export async function obtenerEstadoCruzRoja(id: number): Promise<any> {
  const cacheKey = `cruzroja-${id}`;
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    console.log(`✅ [CACHE] Cruz Roja ID ${id}`);
    return {
      ...cached.value,
      ultimaActualizacion: cached.updatedAt.toISOString(),
    };
  }

  try {
    const url = 'https://www.cruzroja.es/appjv/consPlayas/fichaPlaya.do';

    const payload = qs.stringify({
      id,
      action: '',
      aplicacion: 'consultaPlayas'
    });

    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const html = iconv.decode(response.data, 'latin1');
    const $ = cheerio.load(html);

    const banderaImgAlt = $('#listaFicha img[alt]').attr('alt')?.trim();
    const coberturaDesde = $('li:contains("Cobertura desde")').next().text().trim() || 'Desconocido';
    const coberturaHasta = $('li:contains("Hasta")').next().text().trim() || 'Desconocido';
    const horario = $('li:contains("Horario")').next().text().trim() || 'Desconocido';

    const resultado = {
      bandera: banderaImgAlt || 'Desconocida',
      coberturaDesde,
      coberturaHasta,
      horario,
    };

    cache.set(cacheKey, resultado);

    return {
      ...resultado,
      ultimaActualizacion: new Date().toISOString(),
    };

  } catch (error: any) {
    console.error(`❌ Error en Cruz Roja (id ${id}):`, error.message);
    return {
      bandera: 'Error',
      error: true,
      ultimaActualizacion: new Date().toISOString(),
    };
  }
}
