import {
  traducirTextoApi,
  razonLegible,
  claveBandera,
  claveEstadoBandera,
  claveNivelVientoMs,
  TABLAS_API,
  traducirOperador,
} from './apiText';
import { traducirNombreDiaApi, formatearFechaCorta } from './fechas';

describe('traducirTextoApi', () => {
  it('en español devuelve el texto original', () => {
    expect(traducirTextoApi('Cielo nublado, temperatura fresca', 'es')).toBe(
      'Cielo nublado, temperatura fresca'
    );
  });

  it('traduce frases compuestas fragmento a fragmento', () => {
    expect(
      traducirTextoApi('Cielo nublado, temperatura fresca, sin cobertura Cruz Roja, oleaje fuerte', 'en')
    ).toBe('Cloudy sky, cool temperature, no Red Cross coverage, heavy surf');
  });

  it('traduce los fragmentos de lluvia del ranking (motivoBaja/razonRanking)', () => {
    expect(traducirTextoApi('Lloviendo ahora, 24°, brisa suave', 'en')).toBe(
      'Raining now, 24°, gentle breeze'
    );
    expect(traducirTextoApi('lluvia en la última hora, temperatura fresca', 'en')).toBe(
      'rain in the last hour, cool temperature'
    );
    expect(traducirTextoApi('Lluvia prevista, temperatura fresca', 'en')).toBe(
      'Rain expected, cool temperature'
    );
  });

  it('traduce la previsión de las próximas horas (WeatherOutlook)', () => {
    expect(traducirTextoApi('Nublado, 20°, brisa suave, mejora en las próximas horas', 'en')).toBe(
      'Cloudy, 20°, gentle breeze, improving in the next few hours'
    );
    // Cuando es el único motivo llega capitalizado desde el backend.
    expect(traducirTextoApi('Empeora en las próximas horas', 'en')).toBe(
      'Getting worse in the next few hours'
    );
  });

  it('conserva la capitalización inicial', () => {
    expect(traducirTextoApi('Nublado', 'en')).toBe('Cloudy');
    expect(traducirTextoApi('nublado', 'en')).toBe('cloudy');
  });

  it('deja intactos fragmentos numéricos y texto no reconocido', () => {
    expect(traducirTextoApi('Nublado, 19°, flojo', 'en')).toBe('Cloudy, 19°, light');
    expect(traducirTextoApi('Texto inventado xyz', 'en')).toBe('Texto inventado xyz');
  });

  it('gestiona null/undefined', () => {
    expect(traducirTextoApi(null, 'en')).toBe('');
    expect(traducirTextoApi(undefined, 'es')).toBe('');
  });
});

describe('razonLegible', () => {
  it('antepone "viento" a flojo/fuerte sueltos', () => {
    expect(razonLegible('Sol, 24°, flojo, bandera verde')).toBe('Sol, 24°, viento flojo, bandera verde');
    expect(razonLegible('Bandera roja, fuerte')).toBe('Bandera roja, viento fuerte');
  });

  it('no duplica "viento" si ya está delante', () => {
    expect(razonLegible('viento fuerte')).toBe('viento fuerte');
    expect(razonLegible('viento flojo del norte')).toBe('viento flojo del norte');
  });

  it('deja intactas las razones sin flojo/fuerte', () => {
    expect(razonLegible('Sol, 24°, sin viento, bandera verde')).toBe('Sol, 24°, sin viento, bandera verde');
  });
});

describe('claveBandera', () => {
  it('mapea los colores a claves de diccionario', () => {
    expect(claveBandera('Negra')).toBe('bandera.negra');
    expect(claveBandera('Roja')).toBe('bandera.roja');
    expect(claveBandera('Amarilla')).toBe('bandera.amarilla');
    expect(claveBandera('Verde')).toBe('bandera.verde');
    expect(claveBandera(undefined)).toBe('bandera.sinDatos');
  });
});

describe('claveEstadoBandera', () => {
  it('mapea el estado a la clave correcta', () => {
    expect(claveEstadoBandera('color', 'Verde')).toBe('bandera.verde');
    expect(claveEstadoBandera('color', 'Roja')).toBe('bandera.roja');
    expect(claveEstadoBandera('fueraDeHorario')).toBe('bandera.fueraDeHorario');
    expect(claveEstadoBandera('sinDatos')).toBe('bandera.sinDatos');
  });
});

describe('claveNivelVientoMs', () => {
  it('clasifica por velocidad', () => {
    expect(claveNivelVientoMs(1)).toBe('viento.sinViento');
    expect(claveNivelVientoMs(4)).toBe('viento.brisaSuave');
    expect(claveNivelVientoMs(8)).toBe('viento.moderado');
    expect(claveNivelVientoMs(12)).toBe('viento.fuerte');
  });
});

describe('fechas', () => {
  it('traduce nombres de día del API', () => {
    expect(traducirNombreDiaApi('domingo', 'en')).toBe('Sunday');
    expect(traducirNombreDiaApi('miercoles', 'en')).toBe('Wednesday');
    expect(traducirNombreDiaApi('domingo', 'es')).toBe('domingo');
    expect(traducirNombreDiaApi('xyz', 'en')).toBeNull();
  });

  it('formatea fecha corta por idioma', () => {
    expect(formatearFechaCorta('Domingo', 5, 5, 'es')).toBe('Domingo 5 de junio');
    expect(formatearFechaCorta('Sunday', 5, 5, 'en')).toBe('Sunday, June 5');
  });
});

describe('viento compuesto', () => {
  const tr = (t: string) => traducirTextoApi(t, 'en');

  it('traduce intensidad + dirección', () => {
    expect(tr('flojo del noreste')).toBe('light wind from the northeast');
    expect(tr('moderado del oeste')).toBe('moderate wind from the west');
    expect(tr('fuerte del noroeste')).toBe('strong wind from the northwest');
    expect(tr('muy fuerte del sur')).toBe('very strong wind from the south');
  });

  it('traduce intensidad + variable', () => {
    expect(tr('flojo variable')).toBe('light variable wind');
    expect(tr('muy fuerte variable')).toBe('very strong variable wind');
  });

  it('acepta las variantes de AEMET "componente" y nordeste/sudoeste', () => {
    expect(tr('moderado de componente norte')).toBe('moderate wind from the north');
    expect(tr('flojo del nordeste')).toBe('light wind from the northeast');
    expect(tr('fuerte del sudoeste')).toBe('strong wind from the southwest');
  });

  it('da lo mismo lleve o no el prefijo "viento" que añade razonLegible', () => {
    // The home and the list go through razonLegible; the detail does not.
    expect(tr('viento flojo del noreste')).toBe('light wind from the northeast');
    expect(tr('flojo del noreste')).toBe('light wind from the northeast');
  });

  it('respeta la mayúscula inicial', () => {
    expect(tr('Flojo del noreste')).toBe('Light wind from the northeast');
  });

  it('compone bien dentro de una razón de ranking completa', () => {
    const razon = razonLegible('Sol, 24°, flojo del noreste, bandera verde');
    expect(razon).toBe('Sol, 24°, viento flojo del noreste, bandera verde');
    expect(traducirTextoApi(razon, 'en')).toBe(
      'Sun, 24°, light wind from the northeast, green flag'
    );
  });

  it('no interfiere con el oleaje de la misma frase', () => {
    expect(tr('Sol, fuerte del noroeste, oleaje fuerte')).toBe(
      'Sun, strong wind from the northwest, heavy surf'
    );
  });

  it('el acierto directo sigue teniendo prioridad', () => {
    expect(tr('Nublado, 19°, flojo')).toBe('Cloudy, 19°, light');
    expect(tr('en calma')).toBe('calm');
  });

  it('SEGURIDAD: no toca el texto libre que contiene "de" o "del"', () => {
    const acceso = 'A pie por el recinto de la península de La Magdalena';
    expect(tr(acceso)).toBe(acceso);
    expect(tr('aviso amarillo por oleaje')).toBe('aviso amarillo por oleaje');
    expect(tr('Desde Monte; último tramo a pie')).toBe('Desde Monte; último tramo a pie');
  });

  it('hueco conocido: las variantes con "tendiendo a" pasan sin traducir', () => {
    const texto = 'moderado del oeste tendiendo a flojo';
    expect(tr(texto)).toBe(texto);
  });
});

describe('entradas nuevas de las tablas', () => {
  const tr = (t: string) => traducirTextoApi(t, 'en');

  it('cubre los niveles de viento y oleaje derivados en el backend', () => {
    expect(tr('viento fresco')).toBe('fresh wind');
    expect(tr('agitado')).toBe('choppy');
    expect(tr('tranquilo')).toBe('calm');
  });

  it('traduce sin desplazar los niveles de la escala Douglas', () => {
    expect(tr('gruesa')).toBe('rough sea');
    expect(tr('muy gruesa')).toBe('very rough sea');
    expect(tr('arbolada')).toBe('high sea');
    expect(tr('montañosa')).toBe('very high sea');
    expect(tr('enorme')).toBe('phenomenal sea');
    expect(tr('mar gruesa')).toBe('rough sea');
  });

  it('cubre la escala de sensación térmica completa', () => {
    expect(tr('templado')).toBe('mild');
    expect(tr('calor moderado')).toBe('warm');
    expect(tr('calor intenso')).toBe('very hot');
  });

  it('cubre los cinco colores de bandera', () => {
    expect(tr('Verde')).toBe('Green');
    expect(tr('Amarilla')).toBe('Yellow');
    expect(tr('Roja')).toBe('Red');
    expect(tr('Negra')).toBe('Black');
    expect(tr('Desconocida')).toBe('Unknown');
  });

  it('cubre los motivos de exclusión, que llegan como cadena completa', () => {
    expect(tr('Baño prohibido (bandera negra)')).toBe('Swimming prohibited (black flag)');
    expect(tr('Bandera roja con viento muy fuerte')).toBe('Red flag with very strong wind');
    expect(tr('Tormenta activa')).toBe('Active storm');
    expect(tr('Alerta meteorológica')).toBe('Weather alert');
    expect(tr('Condiciones peligrosas')).toBe('Dangerous conditions');
  });

  it('cubre los factores de bajada del ranking', () => {
    expect(tr('Condiciones aceptables')).toBe('Acceptable conditions');
    expect(tr('UV muy alto')).toBe('Very high UV');
    expect(tr('temperatura baja')).toBe('low temperature');
    expect(tr('condiciones poco favorables')).toBe('unfavourable conditions');
  });

  it('el nivel UV sigue traduciéndose sin el prefijo que recorta el detalle', () => {
    expect(tr('Muy alto')).toBe('Very high');
    expect(tr('Extremo')).toBe('Extreme');
  });

  it('cubre los tamaños de parking que existen en los datos', () => {
    expect(tr('Menos de 50 plazas')).toBe('Fewer than 50 spaces');
    expect(tr('Entre 50 y 100 plazas')).toBe('50-100 spaces');
  });

  it('traduce el "cielo claro" de OpenWeather, no solo el de AEMET', () => {
    // `tiempoActual.cielo` comes from OpenWeather and uses a different word than AEMET.
    expect(tr('Cielo claro')).toBe('Clear sky');
    expect(tr('Cielo despejado')).toBe('Clear sky');
  });
});

describe('integridad de las tablas', () => {
  it('no hay colisiones entre tablas salvo la documentada de "fresco"', () => {
    const vistas = new Map<string, string>();
    const colisiones: string[] = [];

    for (const [nombre, tabla] of Object.entries(TABLAS_API)) {
      for (const clave of Object.keys(tabla)) {
        const previa = vistas.get(clave);
        if (previa) colisiones.push(`${clave} (${previa} vs ${nombre})`);
        else vistas.set(clave, nombre);
      }
    }

    // 'fresco' is both a wind level and a thermal sensation; sensation
    // wins due to the spread order. Any other collision would be a bug:
    // the last table would silently shadow the previous one.
    expect(colisiones).toEqual(['fresco (MAPA_VIENTO vs MAPA_SENSACION)']);
  });
});

describe('operador de banderas', () => {
  it('traduce el nombre de Cruz Roja y deja intacto uno desconocido', () => {
    expect(traducirOperador('Cruz Roja', 'en')).toBe('Red Cross');
    expect(traducirOperador('Cruz Roja', 'es')).toBe('Cruz Roja');
    expect(traducirOperador('DYA', 'en')).toBe('DYA');
  });

  it('traduce "sin cobertura X" para cualquier operador', () => {
    // Cantabria's exact string keeps its own dictionary entry (contract with
    // the deployed frontend); any other operator goes through the frame.
    expect(traducirTextoApi('sin cobertura Cruz Roja', 'en')).toBe('no Red Cross coverage');
    expect(traducirTextoApi('sin cobertura DYA', 'en')).toBe('no DYA coverage');
  });
});
