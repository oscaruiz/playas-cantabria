import type { Idioma } from './IdiomaContext';
import type { ClaveTexto } from './es';
import type { EstadoBandera } from '../utils/beachHelpers';

/**
 * Traducción es→en de los textos que llegan del backend (AEMET,
 * OpenWeather, Cruz Roja y los generados por el ranking). El backend
 * solo habla español; en inglés traducimos en el cliente los valores
 * conocidos y dejamos intacto (fallback) lo que no reconozcamos.
 *
 * Las frases compuestas (razonRanking, motivoBaja) son fragmentos
 * unidos por comas — se traducen fragmento a fragmento.
 */

// Estados del cielo (vocabulario AEMET / OpenWeather)
const MAPA_CIELO: Record<string, string> = {
  'despejado': 'clear',
  'soleado': 'sunny',
  // Palabras cortas que genera el ranking del backend (razonRanking)
  'sol': 'sun',
  'parcialmente soleado': 'partly sunny',
  'poco nuboso': 'partly cloudy',
  'intervalos nubosos': 'cloudy intervals',
  'intervalos nubosos con lluvia escasa': 'cloudy intervals with light rain',
  'intervalos nubosos con lluvia': 'cloudy intervals with rain',
  'parcialmente nuboso': 'partly cloudy',
  'nuboso': 'cloudy',
  'nublado': 'cloudy',
  'muy nuboso': 'very cloudy',
  'cubierto': 'overcast',
  'cubierto con lluvia escasa': 'overcast with light rain',
  'cubierto con lluvia': 'overcast with rain',
  'cielo nublado': 'cloudy sky',
  'cielo despejado': 'clear sky',
  'cielo cubierto': 'overcast sky',
  'algo de nubes': 'a few clouds',
  'nubes': 'clouds',
  'nubes dispersas': 'scattered clouds',
  // OpenWeather en español dice "cielo claro", no "cielo despejado" (que es lo
  // que dice AEMET). Es el titular del detalle en cualquier día soleado, así que
  // la fuga se veía en la primera línea de la página. Detectado ejecutando la app.
  'cielo claro': 'clear sky',
  'lluvia': 'rain',
  'lluvia ligera': 'light rain',
  'lluvia escasa': 'light rain',
  'llovizna': 'drizzle',
  'chubascos': 'showers',
  'chubascos tormentosos': 'thundery showers',
  'tormenta': 'storm',
  'niebla': 'fog',
  'bruma': 'mist',
  'neblina': 'haze',
  'nieve': 'snow',
};

/**
 * Direcciones cardinales. Se usan sueltas (como fragmento) y como segunda mitad
 * de las descripciones compuestas de AEMET ("flojo del noreste").
 * `nordeste`/`sudoeste` son las variantes que también emite AEMET.
 */
const DIRECCION_VIENTO: Record<string, string> = {
  'norte': 'north',
  'sur': 'south',
  'este': 'east',
  'oeste': 'west',
  'noreste': 'northeast',
  'nordeste': 'northeast',
  'noroeste': 'northwest',
  'sureste': 'southeast',
  'suroeste': 'southwest',
  'sudoeste': 'southwest',
};

/** Intensidades del viento, primera mitad de las descripciones compuestas. */
const INTENSIDAD_VIENTO: Record<string, string> = {
  'en calma': 'calm',
  'calma': 'calm',
  'flojo': 'light',
  'moderado': 'moderate',
  'fresco': 'fresh',
  'fuerte': 'strong',
  'muy fuerte': 'very strong',
};

// Viento (descripciones y fragmentos)
const MAPA_VIENTO: Record<string, string> = {
  ...DIRECCION_VIENTO,
  ...INTENSIDAD_VIENTO,
  'viento flojo': 'light wind',
  'viento moderado': 'moderate wind',
  // `BeachScorer` emite este literal en `razonRanking`. La forma suelta
  // ('fresco') NO se añade aquí: la pisa `MAPA_SENSACION` (ver nota al fusionar).
  'viento fresco': 'fresh wind',
  'viento fuerte': 'strong wind',
  'sin viento': 'no wind',
  'brisa suave': 'gentle breeze',
  'brisa': 'breeze',
  'variable': 'variable',
};

// Oleaje / estado del mar
const MAPA_OLEAJE: Record<string, string> = {
  'oleaje débil': 'light surf',
  'oleaje moderado': 'moderate surf',
  'oleaje fuerte': 'heavy surf',
  'débil': 'light',
  'mar rizada': 'rippled sea',
  'rizada': 'rippled',
  'marejadilla': 'slight sea',
  'marejada': 'moderate sea',
  'fuerte marejada': 'rough sea',
  'mar gruesa': 'rough sea',
  'mar de fondo': 'groundswell',
  // Derivados del viento en el backend (`wavesFromWind`, `wavesTextFromWind`).
  'agitado': 'choppy',
  'tranquilo': 'calm',
  // Resto de la escala Douglas de AEMET. Ojo: NO se añaden 'moderado' ni
  // 'fuerte' sueltos, que ya resuelven vía MAPA_VIENTO — añadirlos aquí los
  // pisaría por el orden del spread.
  'llana': 'calm sea',
  'gruesa': 'rough sea',
  'muy gruesa': 'very rough sea',
  'arbolada': 'high sea',
  'montañosa': 'very high sea',
  'enorme': 'phenomenal sea',
};

// Sensación térmica / temperatura
const MAPA_SENSACION: Record<string, string> = {
  'muy alta': 'very hot',
  'alta': 'hot',
  'agradable': 'pleasant',
  'fresca': 'cool',
  'fría': 'cold',
  'temperatura agradable': 'pleasant temperature',
  'temperatura fresca': 'cool temperature',
  'temperatura muy alta': 'very hot temperature',
  'calor': 'hot',
  'frío': 'cold',
  'fresco': 'cool',
  'muy frío': 'very cold',
  'muy caluroso': 'very hot',
  'caluroso': 'hot',
  // Escala completa de `sensationFromTemp` en el backend.
  'templado': 'mild',
  'calor moderado': 'warm',
  'calor intenso': 'very hot',
};

// Niveles UV ("muy alto" tras quitar el prefijo "índice ultravioleta")
const MAPA_UV: Record<string, string> = {
  'bajo': 'low',
  'medio': 'moderate',
  'alto': 'high',
  'muy alto': 'very high',
  'extremo': 'extreme',
  // Las variantes con el prefijo completo se han eliminado: `PlayaDetalle` lo
  // recorta antes de traducir, así que nunca llegaban a consultarse.
};

// Fragmentos generados por el ranking del backend (razonRanking / motivoBaja)
const MAPA_RANKING: Record<string, string> = {
  'sin cobertura cruz roja': 'no Red Cross coverage',
  'bandera roja': 'red flag',
  'bandera amarilla': 'yellow flag',
  'bandera verde': 'green flag',
  'lloviendo ahora': 'raining now',
  'lluvia en la última hora': 'rain in the last hour',
  'lluvia o tormenta': 'rain or storm',
  'lluvia prevista': 'rain expected',
  'precaución': 'caution',
  'oleaje peligroso': 'dangerous surf',
  'aviso litoral': 'coastal warning',
  'aviso costero activo': 'active coastal warning',
  'sin peligro': 'no danger',
  'peligro': 'danger',
  'riesgo': 'risk',
  'riesgo importante': 'significant risk',
  'riesgo extremo': 'extreme risk',
  // Fragmentos de `buildCautionReason` / `buildDowngradeFactors`.
  'condiciones aceptables': 'acceptable conditions',
  'baño prohibido': 'swimming prohibited',
  'uv muy alto': 'very high UV',
  'temperatura baja': 'low temperature',
  'condiciones poco favorables': 'unfavourable conditions',
  // Motivos de exclusión: llegan como cadena completa, sin comas.
  'baño prohibido (bandera negra)': 'swimming prohibited (black flag)',
  'bandera roja con viento muy fuerte': 'red flag with very strong wind',
  'tormenta activa': 'active storm',
  'alerta meteorológica': 'weather alert',
  'condiciones peligrosas': 'dangerous conditions',
};

// Colores de bandera tal cual llegan de Cruz Roja ("Verde"/"Amarilla"/"Roja")
const MAPA_COLORES: Record<string, string> = {
  'verde': 'green',
  'amarilla': 'yellow',
  'roja': 'red',
  // El backend también emite estas dos (`flagToEs`), aunque hoy la interfaz las
  // trate como "sin datos" — ver known-issues/blackFlag.test.tsx.
  'negra': 'black',
  'desconocida': 'unknown',
};

// Información estática de la playa (tipoPlaya, arena, acceso, bus...)
const MAPA_INFO: Record<string, string> = {
  'urbana': 'urban',
  'semiurbana': 'semi-urban',
  'aislada': 'secluded',
  'acantilados': 'cliffs',
  'arena dorada': 'golden sand',
  'arena dorada y grava': 'golden sand and gravel',
  'arena blanca': 'white sand',
  'arena gris': 'grey sand',
  'arena fina': 'fine sand',
  'arena oscura': 'dark sand',
  'grava': 'gravel',
  'bolos': 'pebbles',
  'roca': 'rock',
  'a pie': 'on foot',
  'en coche': 'by car',
  'en barco': 'by boat',
  'escaleras': 'stairs',
  'rampa': 'ramp',
  'urbano': 'urban',
  'interurbano': 'intercity',
  'sí': 'yes',
  'no': 'no',
  'más de 100 plazas': 'more than 100 spaces',
  'menos de 50 plazas': 'fewer than 50 spaces',
  'entre 50 y 100 plazas': '50-100 spaces',
  'no disponible': 'not available',
};

/**
 * Tabla única de consulta. OJO con el orden: una clave repetida la gana la
 * ÚLTIMA tabla del spread. Hoy solo colisiona `'fresco'`, a propósito:
 * lo emiten tanto el viento como la sensación térmica, y gana la sensación
 * ('cool'). El lado del viento se resuelve donde sí hay contexto: con el
 * literal `'viento fresco'` y dentro de la traducción compuesta.
 *
 * El test `no hay colisiones entre tablas salvo la documentada` vigila que no
 * se cuele ninguna más (p. ej. un `'fuerte'` de oleaje pisaría el del viento).
 */
const MAPA_API: Record<string, string> = {
  ...MAPA_CIELO,
  ...MAPA_VIENTO,
  ...MAPA_OLEAJE,
  ...MAPA_SENSACION,
  ...MAPA_UV,
  ...MAPA_RANKING,
  ...MAPA_COLORES,
  ...MAPA_INFO,
};

/** Tablas expuestas solo para el test que vigila las colisiones. */
export const TABLAS_API = {
  MAPA_CIELO,
  MAPA_VIENTO,
  MAPA_OLEAJE,
  MAPA_SENSACION,
  MAPA_UV,
  MAPA_RANKING,
  MAPA_COLORES,
  MAPA_INFO,
};

/** Conserva la capitalización inicial del texto original. */
function respetarMayuscula(original: string, traduccion: string): string {
  if (!original || !traduccion) return traduccion;
  const empiezaMayuscula = original.charAt(0) === original.charAt(0).toUpperCase();
  if (empiezaMayuscula) {
    return traduccion.charAt(0).toUpperCase() + traduccion.slice(1);
  }
  return traduccion;
}

/**
 * Conectores entre intensidad y dirección, del más específico al menos.
 * El espacio suelto va el último para que "flojo variable" también parta.
 */
const CONECTORES_VIENTO = [' del ', ' de ', ' '];

/**
 * Traduce las descripciones compuestas de viento de AEMET ("flojo del noreste"),
 * que no se pueden enumerar: son intensidad × dirección y el texto es libre.
 *
 * PROPIEDAD DE SEGURIDAD: solo devuelve algo si TODAS las partes son conocidas.
 * Si cualquiera falla, devuelve null y el fragmento se deja intacto. Eso es lo
 * que impide destrozar texto libre que contenga " de " o " del ", como el campo
 * `acceso` ("A pie por el recinto de la península de La Magdalena").
 *
 * Devuelve null si no reconoce la forma.
 */
function traducirVientoCompuesto(fragmento: string): string | null {
  const bajo = fragmento.toLowerCase();

  for (const conector of CONECTORES_VIENTO) {
    // La dirección es siempre el último token, de ahí lastIndexOf.
    const corte = bajo.lastIndexOf(conector);
    if (corte < 0) continue;

    const izq = bajo.slice(0, corte).replace(/^viento /, '');
    const der = bajo.slice(corte + conector.length).replace(/^componente /, '');

    const intensidad = INTENSIDAD_VIENTO[izq];
    if (!intensidad) continue;

    if (der === 'variable') return `${intensidad} variable wind`;

    const direccion = DIRECCION_VIENTO[der];
    if (direccion) return `${intensidad} wind from the ${direccion}`;
  }

  return null;
}

function traducirFragmento(fragmento: string): string {
  if (!fragmento) return fragmento;
  const directo = MAPA_API[fragmento.toLowerCase()];
  if (directo) return respetarMayuscula(fragmento, directo);

  const viento = traducirVientoCompuesto(fragmento);
  if (viento) return respetarMayuscula(fragmento, viento);

  // Fragmento numérico ("19°", "09:00 - 21:00") o texto libre → intacto
  return fragmento;
}

/**
 * Traduce un texto del API al idioma activo. En español devuelve el
 * original; en inglés tokeniza por comas y traduce cada fragmento
 * conocido, dejando el resto tal cual.
 */
export function traducirTextoApi(texto: string | null | undefined, idioma: Idioma): string {
  if (!texto) return '';
  if (idioma === 'es') return texto;
  return texto
    .split(',')
    .map((fragmento) => traducirFragmento(fragmento.trim()))
    .join(', ');
}

/**
 * Antepone "viento" a "flojo/fuerte" en la razón cruda del ranking, para que se lea
 * "viento flojo" en vez de "flojo". Opera sobre el español del API, SIEMPRE antes de
 * traducir con traducirTextoApi.
 */
export function razonLegible(razonRanking: string): string {
  return razonRanking.replace(/(?<!viento )\b(flojo|fuerte)\b/i, 'viento $1');
}

/** Clave de diccionario para la bandera de Cruz Roja (sustituye a flagDisplayText). */
export function claveBandera(bandera?: string): ClaveTexto {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('roja')) return 'bandera.roja';
  if (b.includes('amarilla')) return 'bandera.amarilla';
  if (b.includes('verde')) return 'bandera.verde';
  return 'bandera.sinDatos';
}

/**
 * Clave de diccionario según el estado de la bandera: color real, "fuera de
 * horario" (sin bandera fuera de la vigilancia) o "sin datos".
 */
export function claveEstadoBandera(estado: EstadoBandera, bandera?: string): ClaveTexto {
  if (estado === 'color') return claveBandera(bandera);
  if (estado === 'fueraDeHorario') return 'bandera.fueraDeHorario';
  return 'bandera.sinDatos';
}

/** Clave de diccionario para el nivel de viento según velocidad en m/s. */
export function claveNivelVientoMs(ms: number): ClaveTexto {
  if (ms < 3) return 'viento.sinViento';
  if (ms < 6) return 'viento.brisaSuave';
  if (ms < 10) return 'viento.moderado';
  return 'viento.fuerte';
}
