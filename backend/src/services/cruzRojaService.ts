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
      },
      timeout: 10000 // timeout en milisegundos (10 segundos)
    });


    const html = response.data as string;
    const $ = cheerio.load(html);

    // Buscamos la imagen de la bandera dentro del ul#listaFicha
    const banderaImgAlt = $('#listaFicha img[alt]').attr('alt')?.trim();

    // Ejemplo selector para cobertura desde y hasta (ajustar según estructura real)
    const coberturaDesde = $('li:contains("Cobertura desde")').next().text().trim() || 'Desconocido';
    const coberturaHasta = $('li:contains("Hasta")').next().text().trim() || 'Desconocido';

    // Selector para horario
    const horario = $('li:contains("Horario")').next().text().trim() || 'Desconocido';

    return {
      bandera: banderaImgAlt || 'Desconocida',
      coberturaDesde,
      coberturaHasta,
      horario,
    };
  } catch (error: any) {
    console.error(`❌ Error en Cruz Roja (id ${id}):`, error.message);
    return {
      bandera: 'Error',
      error: true
    };
  }
}
