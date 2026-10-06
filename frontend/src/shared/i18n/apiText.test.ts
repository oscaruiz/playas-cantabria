import {
  translateApiText,
  readableReason,
  flagKey,
  flagStatusKey,
  windLevelKey,
  API_TABLES,
  translateOperator,
} from './apiText';
import { translateApiDayName, formatShortDate } from './fechas';

describe('traducirTextoApi', () => {
  it('en español devuelve el texto original', () => {
    expect(translateApiText('Cielo nublado, temperatura fresca', 'es')).toBe(
      'Cielo nublado, temperatura fresca'
    );
  });

  it('traduce frases compuestas fragmento a fragmento', () => {
    expect(
      translateApiText('Cielo nublado, temperatura fresca, sin cobertura Cruz Roja, oleaje fuerte', 'en')
    ).toBe('Cloudy sky, cool temperature, no Red Cross coverage, heavy surf');
  });

  it('traduce los fragmentos de lluvia del ranking (motivoBaja/razonRanking)', () => {
    expect(translateApiText('Lloviendo ahora, 24°, brisa suave', 'en')).toBe(
      'Raining now, 24°, gentle breeze'
    );
    expect(translateApiText('lluvia en la última hora, temperatura fresca', 'en')).toBe(
      'rain in the last hour, cool temperature'
    );
    expect(translateApiText('Lluvia prevista, temperatura fresca', 'en')).toBe(
      'Rain expected, cool temperature'
    );
  });

  it('traduce la previsión de las próximas horas (WeatherOutlook)', () => {
    expect(translateApiText('Nublado, 20°, brisa suave, mejora en las próximas horas', 'en')).toBe(
      'Cloudy, 20°, gentle breeze, improving in the next few hours'
    );
    // Cuando es el único motivo llega capitalizado desde el backend.
    expect(translateApiText('Empeora en las próximas horas', 'en')).toBe(
      'Getting worse in the next few hours'
    );
  });

  it('conserva la capitalización inicial', () => {
    expect(translateApiText('Nublado', 'en')).toBe('Cloudy');
    expect(translateApiText('nublado', 'en')).toBe('cloudy');
  });

  it('deja intactos fragmentos numéricos y texto no reconocido', () => {
    expect(translateApiText('Nublado, 19°, flojo', 'en')).toBe('Cloudy, 19°, light');
    expect(translateApiText('Texto inventado xyz', 'en')).toBe('Texto inventado xyz');
  });

  it('gestiona null/undefined', () => {
    expect(translateApiText(null, 'en')).toBe('');
    expect(translateApiText(undefined, 'es')).toBe('');
  });
});

describe('razonLegible', () => {
  it('antepone "viento" a flojo/fuerte sueltos', () => {
    expect(readableReason('Sol, 24°, flojo, bandera verde')).toBe('Sol, 24°, viento flojo, bandera verde');
    expect(readableReason('Bandera roja, fuerte')).toBe('Bandera roja, viento fuerte');
  });

  it('no duplica "viento" si ya está delante', () => {
    expect(readableReason('viento fuerte')).toBe('viento fuerte');
    expect(readableReason('viento flojo del norte')).toBe('viento flojo del norte');
  });

  it('deja intactas las razones sin flojo/fuerte', () => {
    expect(readableReason('Sol, 24°, sin viento, bandera verde')).toBe('Sol, 24°, sin viento, bandera verde');
  });
});

describe('claveBandera', () => {
  it('mapea los colores a claves de diccionario', () => {
    expect(flagKey('Negra')).toBe('bandera.negra');
    expect(flagKey('Roja')).toBe('bandera.roja');
    expect(flagKey('Amarilla')).toBe('bandera.amarilla');
    expect(flagKey('Verde')).toBe('bandera.verde');
    expect(flagKey(undefined)).toBe('bandera.sinDatos');
  });
});

describe('claveEstadoBandera', () => {
  it('mapea el estado a la clave correcta', () => {
    expect(flagStatusKey('color', 'Verde')).toBe('bandera.verde');
    expect(flagStatusKey('color', 'Roja')).toBe('bandera.roja');
    expect(flagStatusKey('fueraDeHorario')).toBe('bandera.fueraDeHorario');
    expect(flagStatusKey('sinDatos')).toBe('bandera.sinDatos');
  });
});

describe('claveNivelVientoMs', () => {
  it('clasifica por velocidad', () => {
    expect(windLevelKey(1)).toBe('viento.sinViento');
    expect(windLevelKey(4)).toBe('viento.brisaSuave');
    expect(windLevelKey(8)).toBe('viento.moderado');
    expect(windLevelKey(12)).toBe('viento.fuerte');
  });
});

describe('fechas', () => {
  it('traduce nombres de día del API', () => {
    expect(translateApiDayName('domingo', 'en')).toBe('Sunday');
    expect(translateApiDayName('miercoles', 'en')).toBe('Wednesday');
    expect(translateApiDayName('domingo', 'es')).toBe('domingo');
    expect(translateApiDayName('xyz', 'en')).toBeNull();
  });

  it('formatea fecha corta por idioma', () => {
    expect(formatShortDate('Domingo', 5, 5, 'es')).toBe('Domingo 5 de junio');
    expect(formatShortDate('Sunday', 5, 5, 'en')).toBe('Sunday, June 5');
  });
});

describe('viento compuesto', () => {
  const tr = (t: string) => translateApiText(t, 'en');

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
    const rationale = readableReason('Sol, 24°, flojo del noreste, bandera verde');
    expect(rationale).toBe('Sol, 24°, viento flojo del noreste, bandera verde');
    expect(translateApiText(rationale, 'en')).toBe(
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
    const access = 'A pie por el recinto de la península de La Magdalena';
    expect(tr(access)).toBe(access);
    expect(tr('aviso amarillo por oleaje')).toBe('aviso amarillo por oleaje');
    expect(tr('Desde Monte; último tramo a pie')).toBe('Desde Monte; último tramo a pie');
  });

  it('hueco conocido: las variantes con "tendiendo a" pasan sin traducir', () => {
    const text = 'moderado del oeste tendiendo a flojo';
    expect(tr(text)).toBe(text);
  });
});

describe('entradas nuevas de las tablas', () => {
  const tr = (t: string) => translateApiText(t, 'en');

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
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const [name, table] of Object.entries(API_TABLES)) {
      for (const key of Object.keys(table)) {
        const prior = seen.get(key);
        if (prior) collisions.push(`${key} (${prior} vs ${name})`);
        else seen.set(key, name);
      }
    }

    // 'fresco' is both a wind level and a thermal sensation; sensation
    // wins due to the spread order. Any other collision would be a bug:
    // the last table would silently shadow the previous one.
    expect(collisions).toEqual(['fresco (MAPA_VIENTO vs MAPA_SENSACION)']);
  });
});

describe('operador de banderas', () => {
  it('traduce el nombre de Cruz Roja y deja intacto uno desconocido', () => {
    expect(translateOperator('Cruz Roja', 'en')).toBe('Red Cross');
    expect(translateOperator('Cruz Roja', 'es')).toBe('Cruz Roja');
    expect(translateOperator('DYA', 'en')).toBe('DYA');
  });

  it('traduce "sin cobertura X" para cualquier operador', () => {
    // Cantabria's exact string keeps its own dictionary entry (contract with
    // the deployed frontend); any other operator goes through the frame.
    expect(translateApiText('sin cobertura Cruz Roja', 'en')).toBe('no Red Cross coverage');
    expect(translateApiText('sin cobertura DYA', 'en')).toBe('no DYA coverage');
  });
});
