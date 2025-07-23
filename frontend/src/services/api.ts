export interface Playa {
  nombre: string;
  municipio: string;
  codigo: string;
  idCruzRoja: number;
}

export async function getPlayas(): Promise<Playa[]> {
  const res = await fetch('http://localhost:4000/api/playas');
  if (!res.ok) throw new Error('Error al obtener playas');
  return res.json();
}

export interface PrediccionDia {
  estadoCielo: { descripcion1: string };
  viento: { descripcion1: string };
  oleaje: { descripcion1: string };
  tagua: { valor1: number };
  tmaxima: { valor1: number };
  stermica: { descripcion1: string };
  uvMax: { valor1: number };
  fecha: number;
}

export interface PlayaDetalle {
  nombre: string;
  municipio: string;
  codigo: string;
  idCruzRoja: number;
  aemet: {
    nombre: string;
    prediccion: {
      dia: PrediccionDia[];
    };
  };
  cruzRoja?: {
    bandera?: string;
    coberturaDesde?: string;
    coberturaHasta?: string;
    horario?: string;
  };
}

export async function getDetallePlaya(codigo: string): Promise<PlayaDetalle> {
  const res = await fetch(`http://localhost:4000/api/playas/${codigo}`);
  if (!res.ok) throw new Error('No se pudo cargar el detalle de la playa');
  return res.json();
}
