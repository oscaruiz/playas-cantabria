import { obtenerPrediccionConFallback } from './prediccionService';
import { StandardWeather } from '../core/types/Weather';

// Código de playa real de Cantabria (La Concha, Suances)
const PLAYA_TEST_CODIGO = '3908503';

describe('Servicio de Predicción', () => {
  jest.setTimeout(10000); // Aumentamos el timeout para las llamadas API

  it('debería obtener predicción de AEMET correctamente', async () => {
    const prediccion = await obtenerPrediccionConFallback(PLAYA_TEST_CODIGO);
    
    // Verificar estructura de respuesta
    expect(prediccion).toHaveProperty('source');
    expect(prediccion).toHaveProperty('lastUpdated');
    expect(prediccion).toHaveProperty('forecast');
    expect(prediccion.forecast).toHaveProperty('today');
    expect(prediccion.forecast).toHaveProperty('tomorrow');

    // Verificar datos del pronóstico
    expect(prediccion.source).toBe('AEMET');
    expect(prediccion.forecast.today).toHaveProperty('summary');
    expect(prediccion.forecast.today).toHaveProperty('temperature');
    expect(prediccion.forecast.today).toHaveProperty('waterTemperature');
    expect(prediccion.forecast.today).toHaveProperty('sensation');
    expect(prediccion.forecast.today).toHaveProperty('wind');
    expect(prediccion.forecast.today).toHaveProperty('waves');
    expect(prediccion.forecast.today).toHaveProperty('uvIndex');
    expect(prediccion.forecast.today).toHaveProperty('icon');

    // Verificar tipos de datos
    expect(typeof prediccion.forecast.today.temperature).toBe('number');
    expect(typeof prediccion.forecast.today.waterTemperature).toBe('number');
    expect(typeof prediccion.forecast.today.wind).toBe('string');
    expect(typeof prediccion.forecast.today.waves).toBe('string');
    if (prediccion.forecast.today.uvIndex !== undefined) {
      expect(typeof prediccion.forecast.today.uvIndex).toBe('number');
    }
  });

  it('debería fallar over a OpenWeather si AEMET falla', async () => {
    // Usamos un código válido para OpenWeather pero inválido para AEMET
    const prediccion = await obtenerPrediccionConFallback('3908503_TEST');
    
    // Debería haber cambiado a OpenWeather
    expect(prediccion.source).toBe('OpenWeatherMap');
    
    // Verificar datos del pronóstico
    expect(prediccion.forecast.today).toHaveProperty('summary');
    expect(prediccion.forecast.today).toHaveProperty('temperature');
    expect(prediccion.forecast.today).toHaveProperty('waterTemperature');
    expect(prediccion.forecast.today).toHaveProperty('sensation');
    expect(prediccion.forecast.today).toHaveProperty('wind');
    expect(prediccion.forecast.today).toHaveProperty('waves');
    expect(prediccion.forecast.today).toHaveProperty('icon');

    // Verificar tipos de datos
    expect(typeof prediccion.forecast.today.temperature).toBe('number');
    expect(typeof prediccion.forecast.today.waterTemperature).toBe('number');
    expect(typeof prediccion.forecast.today.wind).toBe('string');
    expect(typeof prediccion.forecast.today.waves).toBe('string');
    expect(typeof prediccion.forecast.today.sensation).toBe('string');
  });
});
