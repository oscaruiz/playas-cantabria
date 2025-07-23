import axios from 'axios';
import qs from 'qs';
import * as cheerio from 'cheerio';

export async function obtenerEstadoCruzRoja(id: number): Promise<any> {
  try {
    const url = 'https://www.cruzroja.es/appjv/consPlayas/fichaPlaya.do';

    const payload = qs.stringify({
      id,
      action: '',
      aplicacion: 'consultaPlayas'
    });

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const html = response.data as string;
    const $ = cheerio.load(html);

    // Buscamos la imagen de la bandera dentro del ul#listaFicha
    const banderaImgAlt = $('#listaFicha img[alt]').attr('alt')?.trim();

    return {
      bandera: banderaImgAlt || 'Desconocida'
    };
  } catch (error: any) {
    console.error(`❌ Error en Cruz Roja (id ${id}):`, error.message);
    return {
      bandera: 'Error',
      error: true
    };
  }
}
