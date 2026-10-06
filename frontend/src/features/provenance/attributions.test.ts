import { sourceAttribution, sameSource, publicSourceName } from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/attributions';

describe('atribucionDeFuente', () => {
  it('credits AEMET whatever transport the API names', () => {
    for (const source of ['AEMET', 'AEMET_XML', 'AEMET_HTML']) {
      const attribution = sourceAttribution(source);
      expect(attribution?.name).toBe('AEMET');
      expect(attribution?.url).toBe('https://www.aemet.es');
      expect(attribution?.note).toBe('atribucion.aemet');
    }
  });

  it('recognises the source however it is spelled', () => {
    expect(sourceAttribution('Open-Meteo')?.name).toBe('Open-Meteo');
    expect(sourceAttribution('OpenMeteo')?.name).toBe('Open-Meteo');
    expect(sourceAttribution('Cruz Roja')?.name).toBe('Cruz Roja');
  });

  it('every credited source carries a link to its own terms', () => {
    for (const source of ['AEMET', 'OpenWeather', 'Open-Meteo', 'Cruz Roja', 'OpenStreetMap']) {
      expect(sourceAttribution(source)?.url).toMatch(/^https:\/\//);
    }
  });

  it('returns null for an unknown source instead of inventing an attribution', () => {
    expect(sourceAttribution('Meteovecino')).toBeNull();
    expect(sourceAttribution(null)).toBeNull();
    expect(sourceAttribution('')).toBeNull();
  });
});

describe('nombrePublicoFuente', () => {
  it('normalizes what it knows and leaves the rest intact', () => {
    expect(publicSourceName('AEMET_HTML')).toBe('AEMET');
    expect(publicSourceName('Meteovecino')).toBe('Meteovecino');
  });
});

describe('mismaFuente', () => {
  it('sees through the transport suffix', () => {
    expect(sameSource('AEMET_HTML', 'AEMET')).toBe(true);
    expect(sameSource('OpenWeather', 'Open-Meteo')).toBe(false);
  });

  it('an absent source is never "the same" as another', () => {
    expect(sameSource(null, 'AEMET')).toBe(false);
    expect(sameSource(undefined, undefined)).toBe(false);
  });
});
