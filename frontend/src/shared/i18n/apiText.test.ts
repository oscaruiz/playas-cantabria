import {
  translateApiText,
  readableReason,
  flagKey,
  flagStatusKey,
  windLevelKey,
  API_TABLES,
  translateOperator,
} from './apiText';
import { translateApiDayName, formatShortDate } from './dates';

describe('translateApiText', () => {
  it('in Spanish returns the original text', () => {
    expect(translateApiText('Cielo nublado, temperatura fresca', 'es')).toBe(
      'Cielo nublado, temperatura fresca'
    );
  });

  it('translates compound phrases fragment by fragment', () => {
    expect(
      translateApiText('Cielo nublado, temperatura fresca, sin cobertura Cruz Roja, oleaje fuerte', 'en')
    ).toBe('Cloudy sky, cool temperature, no Red Cross coverage, heavy surf');
  });

  it('translates the ranking rain fragments (motivoBaja/razonRanking)', () => {
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

  it('translates the outlook for the next few hours (WeatherOutlook)', () => {
    expect(translateApiText('Nublado, 20°, brisa suave, mejora en las próximas horas', 'en')).toBe(
      'Cloudy, 20°, gentle breeze, improving in the next few hours'
    );
    // When it is the only reason it arrives capitalized from the backend.
    expect(translateApiText('Empeora en las próximas horas', 'en')).toBe(
      'Getting worse in the next few hours'
    );
  });

  it('keeps the initial capitalization', () => {
    expect(translateApiText('Nublado', 'en')).toBe('Cloudy');
    expect(translateApiText('nublado', 'en')).toBe('cloudy');
  });

  it('leaves numeric fragments and unrecognized text intact', () => {
    expect(translateApiText('Nublado, 19°, flojo', 'en')).toBe('Cloudy, 19°, light');
    expect(translateApiText('Texto inventado xyz', 'en')).toBe('Texto inventado xyz');
  });

  it('handles null/undefined', () => {
    expect(translateApiText(null, 'en')).toBe('');
    expect(translateApiText(undefined, 'es')).toBe('');
  });
});

describe('readableReason', () => {
  it('prepends "viento" to a bare flojo/fuerte', () => {
    expect(readableReason('Sol, 24°, flojo, bandera verde')).toBe('Sol, 24°, viento flojo, bandera verde');
    expect(readableReason('Bandera roja, fuerte')).toBe('Bandera roja, viento fuerte');
  });

  it('does not duplicate "viento" if it is already in front', () => {
    expect(readableReason('viento fuerte')).toBe('viento fuerte');
    expect(readableReason('viento flojo del norte')).toBe('viento flojo del norte');
  });

  it('leaves reasons without flojo/fuerte intact', () => {
    expect(readableReason('Sol, 24°, sin viento, bandera verde')).toBe('Sol, 24°, sin viento, bandera verde');
  });
});

describe('flagKey', () => {
  it('maps colors to dictionary keys', () => {
    expect(flagKey('Negra')).toBe('bandera.negra');
    expect(flagKey('Roja')).toBe('bandera.roja');
    expect(flagKey('Amarilla')).toBe('bandera.amarilla');
    expect(flagKey('Verde')).toBe('bandera.verde');
    expect(flagKey(undefined)).toBe('bandera.sinDatos');
  });
});

describe('flagStatusKey', () => {
  it('maps the state to the right key', () => {
    expect(flagStatusKey('color', 'Verde')).toBe('bandera.verde');
    expect(flagStatusKey('color', 'Roja')).toBe('bandera.roja');
    expect(flagStatusKey('fueraDeHorario')).toBe('bandera.fueraDeHorario');
    expect(flagStatusKey('sinDatos')).toBe('bandera.sinDatos');
  });
});

describe('windLevelKey', () => {
  it('classifies by speed', () => {
    expect(windLevelKey(1)).toBe('viento.sinViento');
    expect(windLevelKey(4)).toBe('viento.brisaSuave');
    expect(windLevelKey(8)).toBe('viento.moderado');
    expect(windLevelKey(12)).toBe('viento.fuerte');
  });
});

describe('dates', () => {
  it('translates day names from the API', () => {
    expect(translateApiDayName('domingo', 'en')).toBe('Sunday');
    expect(translateApiDayName('miercoles', 'en')).toBe('Wednesday');
    expect(translateApiDayName('domingo', 'es')).toBe('domingo');
    expect(translateApiDayName('xyz', 'en')).toBeNull();
  });

  it('formats the short date per language', () => {
    expect(formatShortDate('Domingo', 5, 5, 'es')).toBe('Domingo 5 de junio');
    expect(formatShortDate('Sunday', 5, 5, 'en')).toBe('Sunday, June 5');
  });
});

describe('compound wind', () => {
  const tr = (t: string) => translateApiText(t, 'en');

  it('translates intensity + direction', () => {
    expect(tr('flojo del noreste')).toBe('light wind from the northeast');
    expect(tr('moderado del oeste')).toBe('moderate wind from the west');
    expect(tr('fuerte del noroeste')).toBe('strong wind from the northwest');
    expect(tr('muy fuerte del sur')).toBe('very strong wind from the south');
  });

  it('translates intensity + variable', () => {
    expect(tr('flojo variable')).toBe('light variable wind');
    expect(tr('muy fuerte variable')).toBe('very strong variable wind');
  });

  it('accepts AEMET variants "componente" and nordeste/sudoeste', () => {
    expect(tr('moderado de componente norte')).toBe('moderate wind from the north');
    expect(tr('flojo del nordeste')).toBe('light wind from the northeast');
    expect(tr('fuerte del sudoeste')).toBe('strong wind from the southwest');
  });

  it('gives the same result with or without the "viento" prefix that readableReason adds', () => {
    // The home and the list go through readableReason; the detail does not.
    expect(tr('viento flojo del noreste')).toBe('light wind from the northeast');
    expect(tr('flojo del noreste')).toBe('light wind from the northeast');
  });

  it('respects the initial capital letter', () => {
    expect(tr('Flojo del noreste')).toBe('Light wind from the northeast');
  });

  it('composes correctly inside a full ranking reason', () => {
    const rationale = readableReason('Sol, 24°, flojo del noreste, bandera verde');
    expect(rationale).toBe('Sol, 24°, viento flojo del noreste, bandera verde');
    expect(translateApiText(rationale, 'en')).toBe(
      'Sun, 24°, light wind from the northeast, green flag'
    );
  });

  it('does not interfere with the swell in the same phrase', () => {
    expect(tr('Sol, fuerte del noroeste, oleaje fuerte')).toBe(
      'Sun, strong wind from the northwest, heavy surf'
    );
  });

  it('a direct hit still takes priority', () => {
    expect(tr('Nublado, 19°, flojo')).toBe('Cloudy, 19°, light');
    expect(tr('en calma')).toBe('calm');
  });

  it('SAFETY: does not touch free text containing "de" or "del"', () => {
    const access = 'A pie por el recinto de la península de La Magdalena';
    expect(tr(access)).toBe(access);
    expect(tr('aviso amarillo por oleaje')).toBe('aviso amarillo por oleaje');
    expect(tr('Desde Monte; último tramo a pie')).toBe('Desde Monte; último tramo a pie');
  });

  it('known gap: variants with "tendiendo a" pass through untranslated', () => {
    const text = 'moderado del oeste tendiendo a flojo';
    expect(tr(text)).toBe(text);
  });
});

describe('new table entries', () => {
  const tr = (t: string) => translateApiText(t, 'en');

  it('covers the wind and swell levels derived in the backend', () => {
    expect(tr('viento fresco')).toBe('fresh wind');
    expect(tr('agitado')).toBe('choppy');
    expect(tr('tranquilo')).toBe('calm');
  });

  it('translates without displacing the Douglas scale levels', () => {
    expect(tr('gruesa')).toBe('rough sea');
    expect(tr('muy gruesa')).toBe('very rough sea');
    expect(tr('arbolada')).toBe('high sea');
    expect(tr('montañosa')).toBe('very high sea');
    expect(tr('enorme')).toBe('phenomenal sea');
    expect(tr('mar gruesa')).toBe('rough sea');
  });

  it('covers the full thermal sensation scale', () => {
    expect(tr('templado')).toBe('mild');
    expect(tr('calor moderado')).toBe('warm');
    expect(tr('calor intenso')).toBe('very hot');
  });

  it('covers the five flag colors', () => {
    expect(tr('Verde')).toBe('Green');
    expect(tr('Amarilla')).toBe('Yellow');
    expect(tr('Roja')).toBe('Red');
    expect(tr('Negra')).toBe('Black');
    expect(tr('Desconocida')).toBe('Unknown');
  });

  it('covers the exclusion reasons, which arrive as a full string', () => {
    expect(tr('Baño prohibido (bandera negra)')).toBe('Swimming prohibited (black flag)');
    expect(tr('Bandera roja con viento muy fuerte')).toBe('Red flag with very strong wind');
    expect(tr('Tormenta activa')).toBe('Active storm');
    expect(tr('Alerta meteorológica')).toBe('Weather alert');
    expect(tr('Condiciones peligrosas')).toBe('Dangerous conditions');
  });

  it('covers the ranking downgrade factors', () => {
    expect(tr('Condiciones aceptables')).toBe('Acceptable conditions');
    expect(tr('UV muy alto')).toBe('Very high UV');
    expect(tr('temperatura baja')).toBe('low temperature');
    expect(tr('condiciones poco favorables')).toBe('unfavourable conditions');
  });

  it('the UV level is still translated without the prefix that the detail trims', () => {
    expect(tr('Muy alto')).toBe('Very high');
    expect(tr('Extremo')).toBe('Extreme');
  });

  it('covers the parking sizes that exist in the data', () => {
    expect(tr('Menos de 50 plazas')).toBe('Fewer than 50 spaces');
    expect(tr('Entre 50 y 100 plazas')).toBe('50-100 spaces');
  });

  it(`translates OpenWeather's "cielo claro", not only AEMET's`, () => {
    // `tiempoActual.cielo` comes from OpenWeather and uses a different word than AEMET.
    expect(tr('Cielo claro')).toBe('Clear sky');
    expect(tr('Cielo despejado')).toBe('Clear sky');
  });
});

describe('table integrity', () => {
  it('no collisions between tables except the documented one for "fresco"', () => {
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
    expect(collisions).toEqual(['fresco (WIND_MAP vs FEELS_LIKE_MAP)']);
  });
});

describe('flag operator', () => {
  it('translates the Cruz Roja name and leaves an unknown one intact', () => {
    expect(translateOperator('Cruz Roja', 'en')).toBe('Red Cross');
    expect(translateOperator('Cruz Roja', 'es')).toBe('Cruz Roja');
    expect(translateOperator('DYA', 'en')).toBe('DYA');
  });

  it('translates "sin cobertura X" for any operator', () => {
    // Cantabria's exact string keeps its own dictionary entry (contract with
    // the deployed frontend); any other operator goes through the frame.
    expect(translateApiText('sin cobertura Cruz Roja', 'en')).toBe('no Red Cross coverage');
    expect(translateApiText('sin cobertura DYA', 'en')).toBe('no DYA coverage');
  });
});
