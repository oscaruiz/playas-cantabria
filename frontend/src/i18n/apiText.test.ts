import { traducirTextoApi, claveBandera, claveEstadoBandera, claveNivelVientoMs } from './apiText';
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

describe('claveBandera', () => {
  it('mapea los colores a claves de diccionario', () => {
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
