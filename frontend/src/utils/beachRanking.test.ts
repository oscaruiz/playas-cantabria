import {
  haversineKm,
  scoreAjustado,
  rankearPlayas,
  codigoMejorPuntuacionNoHero,
  PENALIZACION_PTS_POR_KM,
  PENALIZACION_MAX_PTS,
  PlayaRankeable,
} from './beachRanking';

// Usuario fijo; las playas se colocan al norte a distancia exacta `d` km
// (1 grado de latitud ≈ 111.32 km), así haversine ≈ d con error < 0.1%.
const USUARIO: [number, number] = [43.4, -3.8];

function playa(codigo: string, nombre: string, puntuacion: number, distKm: number): PlayaRankeable {
  return { codigo, nombre, puntuacion, lat: USUARIO[0] + distKm / 111.32, lon: USUARIO[1] };
}

// Caso real que disparaba el ciclo del comparador antiguo
const MOGRO = playa('mogro', 'Mogro-Usil', 78, 15);
const SARDINERO = playa('sardinero', 'Sardinero', 82, 30);
const SOMO = playa('somo', 'Somo', 84, 33);
const CUBERRIS = playa('cuberris', 'Cuberris', 83, 44);

describe('haversineKm', () => {
  it('aproxima la distancia norte-sur construida con el fixture', () => {
    const p = playa('x', 'X', 0, 20);
    expect(haversineKm(USUARIO[0], USUARIO[1], p.lat, p.lon)).toBeCloseTo(20, 1);
  });
});

describe('scoreAjustado', () => {
  it('reproduce la tabla de calibración', () => {
    expect(scoreAjustado(78, 15)).toBeCloseTo(78 - 15 * PENALIZACION_PTS_POR_KM);
    expect(scoreAjustado(84, 33)).toBeCloseTo(84 - 33 * PENALIZACION_PTS_POR_KM);
    expect(scoreAjustado(82, 30)).toBeCloseTo(82 - 30 * PENALIZACION_PTS_POR_KM);
    expect(scoreAjustado(83, 44)).toBeCloseTo(83 - 44 * PENALIZACION_PTS_POR_KM);
  });

  it('aplica el tope de penalización', () => {
    expect(scoreAjustado(95, 200)).toBe(95 - PENALIZACION_MAX_PTS);
  });

  it('con distancia no finita devuelve la puntuación cruda', () => {
    expect(scoreAjustado(80, NaN)).toBe(80);
    expect(scoreAjustado(80, Infinity)).toBe(80);
  });
});

describe('rankearPlayas', () => {
  it('sin ubicación ordena por puntuación desc y nombre asc en empates', () => {
    const pool = [
      playa('b', 'Berria', 70, 5),
      playa('a', 'Arnía', 70, 50),
      playa('c', 'Comillas', 90, 100),
    ];
    const orden = rankearPlayas(pool, null).map((p) => p.codigo);
    expect(orden).toEqual(['c', 'a', 'b']);
  });

  it('resuelve el ciclo real de forma determinista con cualquier permutación', () => {
    const esperado = ['mogro', 'somo', 'sardinero', 'cuberris'];
    const permutaciones = [
      [MOGRO, SARDINERO, SOMO, CUBERRIS],
      [SOMO, MOGRO, CUBERRIS, SARDINERO],
      [CUBERRIS, SOMO, SARDINERO, MOGRO],
      [SARDINERO, CUBERRIS, MOGRO, SOMO],
    ];
    for (const pool of permutaciones) {
      expect(rankearPlayas(pool, USUARIO).map((p) => p.codigo)).toEqual(esperado);
    }
  });

  it('empate total (puntuación y distancia) → nombre asc', () => {
    const pool = [playa('z', 'Zubieta', 75, 10), playa('a', 'Arenal', 75, 10)];
    expect(rankearPlayas(pool, USUARIO).map((p) => p.codigo)).toEqual(['a', 'z']);
  });

  it('mismo score ajustado con cruda distinta → gana la cruda mayor', () => {
    // 80@10km → 76 ajustado; 76@0km → 76 ajustado
    const pool = [playa('cerca', 'Cerca', 76, 0), playa('lejos', 'Lejos', 80, 10)];
    expect(rankearPlayas(pool, USUARIO).map((p) => p.codigo)).toEqual(['lejos', 'cerca']);
  });

  it('el tope hace que dos playas lejanas se ordenen por cruda', () => {
    const pool = [playa('l1', 'Lejana Uno', 70, 80), playa('l2', 'Lejana Dos', 85, 200)];
    expect(rankearPlayas(pool, USUARIO).map((p) => p.codigo)).toEqual(['l2', 'l1']);
  });

  it('playa muy buena pero lejísimos pierde contra buena cercana', () => {
    const pool = [playa('top', 'Top', 95, 200), playa('local', 'Local', 78, 5)];
    expect(rankearPlayas(pool, USUARIO).map((p) => p.codigo)).toEqual(['local', 'top']);
  });

  it('respeta max y los casos triviales', () => {
    expect(rankearPlayas([], USUARIO)).toEqual([]);
    expect(rankearPlayas([MOGRO], USUARIO)).toEqual([MOGRO]);
    const seis = [MOGRO, SARDINERO, SOMO, CUBERRIS, playa('e', 'E', 65, 1), playa('f', 'F', 64, 2)];
    expect(rankearPlayas(seis, USUARIO)).toHaveLength(5);
  });

  it('no muta el array de entrada', () => {
    const pool = [SOMO, MOGRO, SARDINERO];
    const copia = [...pool];
    rankearPlayas(pool, USUARIO);
    rankearPlayas(pool, null);
    expect(pool).toEqual(copia);
  });
});

describe('codigoMejorPuntuacionNoHero', () => {
  it('null si la hero ya es la máxima', () => {
    expect(codigoMejorPuntuacionNoHero([SOMO, CUBERRIS, SARDINERO, MOGRO])).toBeNull();
  });

  it('null si la hero empata con la máxima', () => {
    const empatada = playa('otra', 'Otra', 78, 40);
    expect(codigoMejorPuntuacionNoHero([MOGRO, empatada])).toBeNull();
  });

  it('devuelve la alternativa con mayor cruda cuando supera a la hero', () => {
    expect(codigoMejorPuntuacionNoHero([MOGRO, SOMO, SARDINERO, CUBERRIS])).toBe('somo');
  });

  it('empate de máxima entre alternativas → la primera en orden de ranking', () => {
    const somoBis = { ...SOMO, codigo: 'somo2', nombre: 'Somo Bis' };
    expect(codigoMejorPuntuacionNoHero([MOGRO, SOMO, somoBis, CUBERRIS])).toBe('somo');
  });

  it('casos triviales', () => {
    expect(codigoMejorPuntuacionNoHero([])).toBeNull();
    expect(codigoMejorPuntuacionNoHero([MOGRO])).toBeNull();
  });
});
