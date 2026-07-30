import { describe, it, expect, vi } from 'vitest';
import { GetBeachDetails } from '../domain/use-cases/GetBeachDetails';
import { Beach } from '../domain/entities/Beach';
import { FlagStatus, FlagRef } from '../domain/entities/Flag';
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
  return { getFlag: async (ref) => byId[ref.ref] ?? null };
}

const cr = (id: number): FlagRef => ({ provider: 'cruzroja', ref: id });

const base: Beach = {
  id: '3907990', name: 'Berria', municipality: 'Santoña',
  aemetCode: '3907990', latitude: 43.46, longitude: -3.46,
};

describe('GetBeachDetails — banderas multi-puesto', () => {
  it('agrega la bandera MÁS restrictiva entre varios puestos', async () => {
    const beach: Beach = {
      ...base,
      flagStations: [
        { ref: cr(101), sourceName: 'BERRIA 1' },
        { ref: cr(102), sourceName: 'BERRIA 2' },
        { ref: cr(103), sourceName: 'BERRIA 3' },
      ],
    };
    const flags = flagProviderFrom({
      101: { color: 'green', timestamp: 1 },
      102: { color: 'red', timestamp: 1 },
      103: { color: 'green', timestamp: 1 },
    });
    const spy = vi.spyOn(flags, 'getFlag');

    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);
    const details = await uc.execute(beach.id);

    expect(spy).toHaveBeenCalledTimes(3); // consulta TODOS los puestos
    expect(details.flag?.color).toBe('red'); // la más restrictiva
  });

  it('ignora puestos sin referencia (pendientes) y no rompe', async () => {
    const beach: Beach = {
      ...base,
      flagStations: [{ sourceName: 'PENDIENTE' }, { ref: cr(200), sourceName: 'CON ID' }],
    };
    const flags = flagProviderFrom({ 200: { color: 'yellow', timestamp: 1 } });
    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);

    const details = await uc.execute(beach.id);
    expect(details.flag?.color).toBe('yellow');
  });

  it('sin puestos con referencia devuelve bandera null (sin cobertura)', async () => {
    const beach: Beach = { ...base, flagStations: [{ sourceName: 'SOLO NOMBRE' }] };
    const flags = flagProviderFrom({});
    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);

    const details = await uc.execute(beach.id);
    expect(details.flag).toBeNull();
  });

  it('cae a la referencia única cuando no hay flagStations (compatibilidad)', async () => {
    const beach: Beach = { ...base, flagRef: cr(373) };
    const flags = flagProviderFrom({ 373: { color: 'green', timestamp: 1 } });
    const uc = new GetBeachDetails(repoWith(beach), weatherStub, weatherStub, flags, null);

    const details = await uc.execute(beach.id);
    expect(details.flag?.color).toBe('green');
  });
});
