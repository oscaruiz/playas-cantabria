import { haversineKm } from '../shared/geo/haversine';
import {
  adjustedScore,
  rankBeaches,
  topScoreCodeNoHero,
  PENALIZACION_PTS_POR_KM,
  PENALIZACION_MAX_PTS,
  RankableBeach,
} from './beachRanking';

// Fixed user; beaches are placed to the north at an exact distance `d` km
// (1 degree of latitude ≈ 111.32 km), so haversine ≈ d with error < 0.1%.
const USER: [number, number] = [43.4, -3.8];

function beach(code: string, name: string, score: number, distKm: number): RankableBeach {
  return { codigo: code, nombre: name, puntuacion: score, lat: USER[0] + distKm / 111.32, lon: USER[1] };
}

// Real case that triggered the old comparator's cycle
const MOGRO = beach('mogro', 'Mogro-Usil', 78, 15);
const SARDINERO = beach('sardinero', 'Sardinero', 82, 30);
const SOMO = beach('somo', 'Somo', 84, 33);
const CUBERRIS = beach('cuberris', 'Cuberris', 83, 44);

describe('haversineKm', () => {
  it('aproxima la distancia norte-sur construida con el fixture', () => {
    const p = beach('x', 'X', 0, 20);
    expect(haversineKm(USER[0], USER[1], p.lat, p.lon)).toBeCloseTo(20, 1);
  });
});

describe('scoreAjustado', () => {
  it('reproduce la tabla de calibración', () => {
    expect(adjustedScore(78, 15)).toBeCloseTo(78 - 15 * PENALIZACION_PTS_POR_KM);
    expect(adjustedScore(84, 33)).toBeCloseTo(84 - 33 * PENALIZACION_PTS_POR_KM);
    expect(adjustedScore(82, 30)).toBeCloseTo(82 - 30 * PENALIZACION_PTS_POR_KM);
    expect(adjustedScore(83, 44)).toBeCloseTo(83 - 44 * PENALIZACION_PTS_POR_KM);
  });

  it('aplica el tope de penalización', () => {
    expect(adjustedScore(95, 200)).toBe(95 - PENALIZACION_MAX_PTS);
  });

  it('con distancia no finita devuelve la puntuación cruda', () => {
    expect(adjustedScore(80, NaN)).toBe(80);
    expect(adjustedScore(80, Infinity)).toBe(80);
  });
});

describe('rankearPlayas', () => {
  it('sin ubicación ordena por puntuación desc y nombre asc en empates', () => {
    const pool = [
      beach('b', 'Berria', 70, 5),
      beach('a', 'Arnía', 70, 50),
      beach('c', 'Comillas', 90, 100),
    ];
    const order = rankBeaches(pool, null).map((p) => p.codigo);
    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('resuelve el ciclo real de forma determinista con cualquier permutación', () => {
    const expected = ['mogro', 'somo', 'sardinero', 'cuberris'];
    const permutations = [
      [MOGRO, SARDINERO, SOMO, CUBERRIS],
      [SOMO, MOGRO, CUBERRIS, SARDINERO],
      [CUBERRIS, SOMO, SARDINERO, MOGRO],
      [SARDINERO, CUBERRIS, MOGRO, SOMO],
    ];
    for (const pool of permutations) {
      expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(expected);
    }
  });

  it('empate total (puntuación y distancia) → nombre asc', () => {
    const pool = [beach('z', 'Zubieta', 75, 10), beach('a', 'Arenal', 75, 10)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['a', 'z']);
  });

  it('mismo score ajustado con cruda distinta → gana la cruda mayor', () => {
    // 80@10km → 76 adjusted; 76@0km → 76 adjusted
    const pool = [beach('cerca', 'Cerca', 76, 0), beach('lejos', 'Lejos', 80, 10)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['lejos', 'cerca']);
  });

  it('el tope hace que dos playas lejanas se ordenen por cruda', () => {
    const pool = [beach('l1', 'Lejana Uno', 70, 80), beach('l2', 'Lejana Dos', 85, 200)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['l2', 'l1']);
  });

  it('playa muy buena pero lejísimos pierde contra buena cercana', () => {
    const pool = [beach('top', 'Top', 95, 200), beach('local', 'Local', 78, 5)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['local', 'top']);
  });

  it('respeta max y los casos triviales', () => {
    expect(rankBeaches([], USER)).toEqual([]);
    expect(rankBeaches([MOGRO], USER)).toEqual([MOGRO]);
    const six = [MOGRO, SARDINERO, SOMO, CUBERRIS, beach('e', 'E', 65, 1), beach('f', 'F', 64, 2)];
    expect(rankBeaches(six, USER)).toHaveLength(5);
  });

  it('no muta el array de entrada', () => {
    const pool = [SOMO, MOGRO, SARDINERO];
    const copy = [...pool];
    rankBeaches(pool, USER);
    rankBeaches(pool, null);
    expect(pool).toEqual(copy);
  });
});

describe('codigoMejorPuntuacionNoHero', () => {
  it('null si la hero ya es la máxima', () => {
    expect(topScoreCodeNoHero([SOMO, CUBERRIS, SARDINERO, MOGRO])).toBeNull();
  });

  it('null si la hero empata con la máxima', () => {
    const tied = beach('otra', 'Otra', 78, 40);
    expect(topScoreCodeNoHero([MOGRO, tied])).toBeNull();
  });

  it('devuelve la alternativa con mayor cruda cuando supera a la hero', () => {
    expect(topScoreCodeNoHero([MOGRO, SOMO, SARDINERO, CUBERRIS])).toBe('somo');
  });

  it('empate de máxima entre alternativas → la primera en orden de ranking', () => {
    const somoBis = { ...SOMO, codigo: 'somo2', nombre: 'Somo Bis' };
    expect(topScoreCodeNoHero([MOGRO, SOMO, somoBis, CUBERRIS])).toBe('somo');
  });

  it('casos triviales', () => {
    expect(topScoreCodeNoHero([])).toBeNull();
    expect(topScoreCodeNoHero([MOGRO])).toBeNull();
  });
});
