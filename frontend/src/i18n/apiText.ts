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

// Viento (descripciones y fragmentos)
const MAPA_VIENTO: Record<string, string> = {
  'en calma': 'calm',
  'calma': 'calm',
  'flojo': 'light',
  'viento flojo': 'light wind',
  'moderado': 'moderate',
  'viento moderado': 'moderate wind',
  'fuerte': 'strong',
  'viento fuerte': 'strong wind',
  'muy fuerte': 'very strong',
  'sin viento': 'no wind',
  'brisa suave': 'gentle breeze',
  'brisa': 'breeze',
  'variable': 'variable',
  'norte': 'north',
  'sur': 'south',
  'este': 'east',
  'oeste': 'west',
  'noreste': 'northeast',
  'noroeste': 'northwest',
  'sureste': 'southeast',
  'suroeste': 'southwest',
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
  'mar gruesa': 'very rough sea',
  'mar de fondo': 'groundswell',
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
};

// Niveles UV ("muy alto" tras quitar el prefijo "índice ultravioleta")
const MAPA_UV: Record<string, string> = {
  'bajo': 'low',
  'medio': 'moderate',
  'alto': 'high',
  'muy alto': 'very high',
  'extremo': 'extreme',
  'índice ultravioleta bajo': 'low UV index',
  'índice ultravioleta medio': 'moderate UV index',
  'índice ultravioleta alto': 'high UV index',
  'índice ultravioleta muy alto': 'very high UV index',
  'índice ultravioleta extremo': 'extreme UV index',
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
};

// Colores de bandera tal cual llegan de Cruz Roja ("Verde"/"Amarilla"/"Roja")
const MAPA_COLORES: Record<string, string> = {
  'verde': 'green',
  'amarilla': 'yellow',
  'roja': 'red',
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
  'menos de 100 plazas': 'fewer than 100 spaces',
  'no disponible': 'not available',
};

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

/** Conserva la capitalización inicial del texto original. */
function respetarMayuscula(original: string, traduccion: string): string {
  if (!original || !traduccion) return traduccion;
  const empiezaMayuscula = original.charAt(0) === original.charAt(0).toUpperCase();
  if (empiezaMayuscula) {
    return traduccion.charAt(0).toUpperCase() + traduccion.slice(1);
  }
  return traduccion;
}

function traducirFragmento(fragmento: string): string {
  if (!fragmento) return fragmento;
  const directo = MAPA_API[fragmento.toLowerCase()];
  if (directo) return respetarMayuscula(fragmento, directo);
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
