// src/services/formateadorPrediccion.ts

export function formatearDesdeAemet(raw: any): { dia: any[] } {
  return {
    dia: raw.prediccion?.dia ?? []
  };
}

export function formatearDesdeOpenWeather(raw: {
  hoy: any;
  mañana: any;
  actual: any;
}): { dia: any[] } {
  function mapDia(dia: any, actual?: any): any {
    const fechaISO = new Date(dia.dt * 1000).toISOString().split('T')[0];

    return {
      fecha: fechaISO,
      estadoCielo: { descripcion1: dia.weather?.[0]?.description || 'Desconocido' },
      viento: { descripcion1: `${dia.wind_speed} m/s` },
      oleaje: { descripcion1: 'Sin datos' },
      tagua: { valor1: actual?.temp || dia.temp?.day || 20 },
      tmaxima: { valor1: dia.temp?.max || 0 },
      stermica: { descripcion1: `${actual?.feels_like || dia.feels_like?.day || 0} ºC` },
      uvMax: { valor1: dia.uvi || 0 }
    };
  }

  return {
    dia: [mapDia(raw.hoy, raw.actual), mapDia(raw.mañana)]
  };
}
