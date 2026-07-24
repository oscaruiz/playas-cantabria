import { describe, it, expect, vi } from 'vitest';
import { GetBeachDetails } from '../domain/use-cases/GetBeachDetails';
import { Beach } from '../domain/entities/Beach';
import { FlagStatus } from '../domain/entities/Flag';
import { BeachRepository } from '../domain/ports/BeachRepository';
import { WeatherProvider } from '../domain/ports/WeatherProvider';
import { FlagProvider } from '../domain/ports/FlagProvider';

const weatherStub: WeatherProvider = {
  getCurrentByCoords: async () => {
    throw new Error('sin clima en el test');
  },
};

function repoWith(beach: Beach): BeachRepository {
  return { getAll: async () => [beach], getById: async (id) => (id === beach.id ? beach : null) };
}

function flagProviderFrom(byId: Record<number, FlagStatus>): FlagProvider {
  return { getFlagByRedCrossId: async (id) => byId[id] ?? null };
}

const base: Beach = {
  id: '3907990', name: 'Berria', municipality: 'Santoña',
  aemetCode: '3907990', latitude: 43.46, longitude: -3.46,
};

describe('GetBeachDetails — banderas multi-puesto', () => {
  it('agrega la bandera MÁS restrictiva entre varios puestos', async () => {
    const beach: Beach = {
      ...base,
      cruzRojaStations: [{ id: 101, nombreFuente: 'BERRIA 1' }, { id: 102, nombreFuente: 'BERRIA 2' }, { id: 103, nombreFuente: 'BERRIA 3' }],
    };
    const flags = flagProviderFrom({
      101: { color: 'green', timestamp: 1 },
      102: { color: 'red', timestamp: 1 },
      103: { color: 'green', timestamp: 1 },
    });
    const spy = vi.spyOn(flags, 'getFlagByRedCrossId');

    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);
    const details = await uc.execute(beach.id);

    expect(spy).toHaveBeenCalledTimes(3); // consulta TODOS los puestos
    expect(details.flag?.color).toBe('red'); // la más restrictiva
  });

  it('ignora puestos sin id (pendientes) y no rompe', async () => {
    const beach: Beach = {
      ...base,
      cruzRojaStations: [{ nombreFuente: 'PENDIENTE' }, { id: 200, nombreFuente: 'CON ID' }],
    };
    const flags = flagProviderFrom({ 200: { color: 'yellow', timestamp: 1 } });
    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);

    const details = await uc.execute(beach.id);
    expect(details.flag?.color).toBe('yellow');
  });

  it('sin puestos con id devuelve bandera null (sin cobertura)', async () => {
    const beach: Beach = { ...base, cruzRojaStations: [{ nombreFuente: 'SOLO NOMBRE' }] };
    const flags = flagProviderFrom({});
    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);

    const details = await uc.execute(beach.id);
    expect(details.flag).toBeNull();
  });

  it('cae al redCrossId único cuando no hay cruzRojaStations (compatibilidad)', async () => {
    const beach: Beach = { ...base, redCrossId: 373 };
    const flags = flagProviderFrom({ 373: { color: 'green', timestamp: 1 } });
    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);

    const details = await uc.execute(beach.id);
    expect(details.flag?.color).toBe('green');
  });
});
