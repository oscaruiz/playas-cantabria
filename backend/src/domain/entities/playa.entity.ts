export type Coordenadas = {
  latitud: number;
  longitud: number;
};

export interface Playa {
  id: string;
  nombre: string;
  municipio: string;
  coordenadas: Coordenadas;
  bandera?: string;
  temperatura?: number;
  oleaje?: number;
  viento?: number;
  precipitacion?: number;
  prediccion?: Prediccion;
}

export interface Prediccion {
  fecha: Date;
  temperatura: number;
  oleaje: number;
  viento: number;
  precipitacion: number;
  estadoCielo: string;
}
