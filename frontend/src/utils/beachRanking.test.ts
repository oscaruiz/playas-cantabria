import { haversineKm } from '../shared/geo/haversine';
import {
  adjustedScore,
  rankBeaches,
  topScoreCodeNoHero,
  PENALTY_PTS_PER_KM,
  MAX_PENALTY_PTS,
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
  it('approximates the north-south distance built with the fixture', () => {
    const p = beach('x', 'X', 0, 20);
    expect(haversineKm(USER[0], USER[1], p.lat, p.lon)).toBeCloseTo(20, 1);
  });
});

describe('adjustedScore', () => {
  it('reproduces the calibration table', () => {
    expect(adjustedScore(78, 15)).toBeCloseTo(78 - 15 * PENALTY_PTS_PER_KM);
    expect(adjustedScore(84, 33)).toBeCloseTo(84 - 33 * PENALTY_PTS_PER_KM);
    expect(adjustedScore(82, 30)).toBeCloseTo(82 - 30 * PENALTY_PTS_PER_KM);
    expect(adjustedScore(83, 44)).toBeCloseTo(83 - 44 * PENALTY_PTS_PER_KM);
  });

  it('applies the penalty cap', () => {
    expect(adjustedScore(95, 200)).toBe(95 - MAX_PENALTY_PTS);
  });

  it('with a non-finite distance returns the raw score', () => {
    expect(adjustedScore(80, NaN)).toBe(80);
    expect(adjustedScore(80, Infinity)).toBe(80);
  });
});

describe('rankBeaches', () => {
  it('without location sorts by score desc and name asc on ties', () => {
    const pool = [
      beach('b', 'Berria', 70, 5),
      beach('a', 'Arnía', 70, 50),
      beach('c', 'Comillas', 90, 100),
    ];
    const order = rankBeaches(pool, null).map((p) => p.codigo);
    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('resolves the real cycle deterministically with any permutation', () => {
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

  it('full tie (score and distance) → name asc', () => {
    const pool = [beach('z', 'Zubieta', 75, 10), beach('a', 'Arenal', 75, 10)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['a', 'z']);
  });

  it('same adjusted score with different raw → the higher raw wins', () => {
    // 80@10km → 76 adjusted; 76@0km → 76 adjusted
    const pool = [beach('cerca', 'Cerca', 76, 0), beach('lejos', 'Lejos', 80, 10)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['lejos', 'cerca']);
  });

  it('the cap makes two distant beaches sort by raw score', () => {
    const pool = [beach('l1', 'Lejana Uno', 70, 80), beach('l2', 'Lejana Dos', 85, 200)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['l2', 'l1']);
  });

  it('a very good but very distant beach loses to a good nearby one', () => {
    const pool = [beach('top', 'Top', 95, 200), beach('local', 'Local', 78, 5)];
    expect(rankBeaches(pool, USER).map((p) => p.codigo)).toEqual(['local', 'top']);
  });

  it('respects max and the trivial cases', () => {
    expect(rankBeaches([], USER)).toEqual([]);
    expect(rankBeaches([MOGRO], USER)).toEqual([MOGRO]);
    const six = [MOGRO, SARDINERO, SOMO, CUBERRIS, beach('e', 'E', 65, 1), beach('f', 'F', 64, 2)];
    expect(rankBeaches(six, USER)).toHaveLength(5);
  });

  it('does not mutate the input array', () => {
    const pool = [SOMO, MOGRO, SARDINERO];
    const copy = [...pool];
    rankBeaches(pool, USER);
    rankBeaches(pool, null);
    expect(pool).toEqual(copy);
  });
});

describe('codigoMejorPuntuacionNoHero', () => {
  it('null if the hero is already the maximum', () => {
    expect(topScoreCodeNoHero([SOMO, CUBERRIS, SARDINERO, MOGRO])).toBeNull();
  });

  it('null if the hero ties with the maximum', () => {
    const tied = beach('otra', 'Otra', 78, 40);
    expect(topScoreCodeNoHero([MOGRO, tied])).toBeNull();
  });

  it('returns the alternative with the highest raw score when it beats the hero', () => {
    expect(topScoreCodeNoHero([MOGRO, SOMO, SARDINERO, CUBERRIS])).toBe('somo');
  });

  it('maximum tie among alternatives → the first in ranking order', () => {
    const somoBis = { ...SOMO, codigo: 'somo2', nombre: 'Somo Bis' };
    expect(topScoreCodeNoHero([MOGRO, SOMO, somoBis, CUBERRIS])).toBe('somo');
  });

  it('trivial cases', () => {
    expect(topScoreCodeNoHero([])).toBeNull();
    expect(topScoreCodeNoHero([MOGRO])).toBeNull();
  });
});
