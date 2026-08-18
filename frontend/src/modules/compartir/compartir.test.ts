import { resumenTarjeta } from './domain/resumenTarjeta';
import { nombreArchivoTarjeta } from './infrastructure/compartirImagen';
import { es } from '../../shared/i18n/es';
import { en } from '../../shared/i18n/en';
import type { ClaveTexto } from '../../shared/i18n/es';
import type { Idioma } from '../../shared/i18n/IdiomaContext';
import type { FeaturedBeach } from '../../services/api';

/** `t` without the provider: the card is built from data, not from a tree. */
const traductor = (idioma: Idioma) => (clave: ClaveTexto) =>
  (idioma === 'en' ? en : es)[clave] ?? clave;

const AHORA = new Date(2026, 7, 5); // 5 August 2026, a Wednesday

const PUNTUADA: FeaturedBeach = {
  nombre: 'La Maruca',
  municipio: 'Santander',
  codigo: '3907501',
  lat: 43.48,
  lon: -3.83,
  temperatura: 20,
  descripcionClima: 'Nublado',
  iconoClima: '04d',
  vientoMs: 1.2,
  bandera: 'Verde',
  puntuacion: 66.4,
  razonRanking: 'Nublado, 20º, sin viento',
  motivoBaja: null,
  atributos: null,
  oleaje: 'Débil',
};

const entrada = (idioma: Idioma, puntuada: FeaturedBeach = PUNTUADA) => ({
  playa: { nombre: 'La Maruca', municipio: 'Santander' },
  puntuada,
  marca: 'Playucas.es',
  sitio: 'playucas.es',
  ahora: AHORA,
  t: traductor(idioma),
  idioma,
});

describe('resumen de la tarjeta compartible', () => {
  it('dice lo mismo que la ficha: nota redondeada, resumen y las tres celdas', () => {
    const r = resumenTarjeta(entrada('es'));

    expect(r.nombre).toBe('La Maruca');
    expect(r.contexto).toBe('Santander · Miércoles 5 de agosto');
    // 66.4 se redondea: la imagen no puede enseñar decimales que la ficha no enseña.
    expect(r.puntuacion).toBe(66);
    expect(r.resumen).toBe('Nublado, 20º, sin viento');
    expect(r.celdas.map((c) => c.valor)).toEqual(['Sin viento', 'Débil', 'Verde']);
    expect(r.celdas[2].bandera).toBe('green');
  });

  it('traduce al inglés todo lo que se pinta, también lo que viene del backend', () => {
    const r = resumenTarjeta(entrada('en'));

    expect(r.contexto).toBe('Santander · Wednesday, August 5');
    expect(r.celdas.map((c) => c.etiqueta)).toEqual(['Wind', 'Waves', 'Flag']);
    expect(r.celdas[1].valor).toBe('Light');
    expect(r.celdas[2].valor).toBe('Green');
    expect(r.aviso).toBe(en['aviso.ranking']);
  });

  // Una celda diciendo "sin bandera ahora" se leía como un fallo. Donde nadie
  // vigila no hay nada que informar, y las dos que quedan ocupan el ancho.
  it('una playa sin vigilancia no trae celda de bandera', () => {
    const r = resumenTarjeta(entrada('es', { ...PUNTUADA, bandera: null }));

    expect(r.celdas).toHaveLength(2);
    expect(r.celdas.map((c) => c.etiqueta)).toEqual(['Viento', 'Oleaje']);
  });

  it('sin viento ni oleaje medidos, lo dice en vez de inventar un valor', () => {
    const r = resumenTarjeta(entrada('es', { ...PUNTUADA, vientoMs: null, oleaje: null }));

    const sinDato = 'Sin dato';
    expect(r.celdas[0].valor).toBe(sinDato);
    expect(r.celdas[1].valor).toBe(sinDato);
  });

  // El ranking redondea el viento por su cuenta: 2,9 m/s puntúa como "sin
  // viento" mientras la previsión del mismo momento dice "flojo". La tarjeta
  // llegó a enseñar las dos, una en la celda y otra en la línea de arriba.
  it('el viento y el oleaje los manda la previsión, que es la que pinta la ficha', () => {
    const r = resumenTarjeta({
      ...entrada('es'),
      prevision: { viento: 'Flojo', oleaje: 'Débil' },
    });

    expect(r.celdas[0].valor).toBe('Flojo');
    expect(r.celdas[1].valor).toBe('Débil');
  });

  it('recorta la tira horaria a cuatro y traduce el cielo a un glifo', () => {
    const r = resumenTarjeta({
      ...entrada('es'),
      horas: [
        { horaIso: '2026-08-05T13:00:00Z', nubesPct: 10, temperaturaC: 21.4, vientoMs: 2.6 },
        { horaIso: '2026-08-05T14:00:00Z', nubesPct: 40, temperaturaC: 22, vientoMs: 3 },
        { horaIso: '2026-08-05T15:00:00Z', nubesPct: 90, temperaturaC: 22, vientoMs: 3 },
        { horaIso: '2026-08-05T16:00:00Z', nubesPct: null, temperaturaC: null, vientoMs: null },
        { horaIso: '2026-08-05T17:00:00Z', nubesPct: 0, temperaturaC: 20, vientoMs: 1 },
      ],
    });

    expect(r.horas).toHaveLength(4);
    expect(r.horas.map((h) => h.emoji)).toEqual(['☀️', '⛅', '☁️', '⛅']);
    expect(r.horas[0]).toMatchObject({ hora: '15:00', temperatura: '21°', viento: '3 m/s' });
    // Lo que falta se dice, no se rellena.
    expect(r.horas[3]).toMatchObject({ temperatura: '--', viento: '--' });
  });

  it('ordena las mareas por hora y le quita a AEMET su asterisco de nota', () => {
    const r = resumenTarjeta({
      ...entrada('es'),
      mareas: { pleamar: ['06:12', '18:40'], bajamar: ['00:05', '12:25'] },
      puertoMareas: '*Puerto de Santander',
    });

    expect(r.mareas.map((m) => m.hora)).toEqual(['00:05', '06:12', '12:25', '18:40']);
    expect(r.mareas.map((m) => m.flecha)).toEqual(['↓', '↑', '↓', '↑']);
    expect(r.puertoMareas).toBe('Puerto de Santander');
  });

  it('sin tira horaria ni mareas, la tarjeta simplemente no las lleva', () => {
    const r = resumenTarjeta(entrada('es'));

    expect(r.horas).toEqual([]);
    expect(r.mareas).toEqual([]);
    expect(r.puertoMareas).toBeNull();
  });

  it('sin previsión cae a lo que midió el ranking', () => {
    const r = resumenTarjeta({ ...entrada('es'), prevision: { viento: null, oleaje: null } });

    expect(r.celdas[0].valor).toBe('Sin viento');
    expect(r.celdas[1].valor).toBe('Débil');
  });

  // El aviso viaja DENTRO de la imagen: una tarjeta reenviada sin él se lee
  // como una promesa sobre el estado del mar, y no lo es.
  it('lleva siempre el aviso, la marca y el sitio', () => {
    const r = resumenTarjeta(entrada('es'));

    expect(r.aviso).toBe(es['aviso.ranking']);
    expect(r.marca).toBe('Playucas.es');
    expect(r.sitio).toBe('playucas.es');
  });
});

describe('nombre del archivo compartido', () => {
  it('es legible en el chat: playa y día, sin tildes ni códigos', () => {
    expect(nombreArchivoTarjeta('La Maruca', AHORA)).toBe('la-maruca-2026-08-05.png');
    expect(nombreArchivoTarjeta('Somo / Loredo', AHORA)).toBe('somo-loredo-2026-08-05.png');
    expect(nombreArchivoTarjeta('Berría', AHORA)).toBe('berria-2026-08-05.png');
  });
});
