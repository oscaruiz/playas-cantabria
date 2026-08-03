import { atribucionDeFuente, mismaFuente, nombrePublicoFuente } from './atribuciones';

describe('atribucionDeFuente', () => {
  it('credits AEMET whatever transport the API names', () => {
    for (const fuente of ['AEMET', 'AEMET_XML', 'AEMET_HTML']) {
      const atribucion = atribucionDeFuente(fuente);
      expect(atribucion?.nombre).toBe('AEMET');
      expect(atribucion?.url).toBe('https://www.aemet.es');
      expect(atribucion?.nota).toBe('atribucion.aemet');
    }
  });

  it('recognises the source however it is spelled', () => {
    expect(atribucionDeFuente('Open-Meteo')?.nombre).toBe('Open-Meteo');
    expect(atribucionDeFuente('OpenMeteo')?.nombre).toBe('Open-Meteo');
    expect(atribucionDeFuente('Cruz Roja')?.nombre).toBe('Cruz Roja');
  });

  it('every credited source carries a link to its own terms', () => {
    for (const fuente of ['AEMET', 'OpenWeather', 'Open-Meteo', 'Cruz Roja', 'OpenStreetMap']) {
      expect(atribucionDeFuente(fuente)?.url).toMatch(/^https:\/\//);
    }
  });

  it('returns null for an unknown source instead of inventing an attribution', () => {
    expect(atribucionDeFuente('Meteovecino')).toBeNull();
    expect(atribucionDeFuente(null)).toBeNull();
    expect(atribucionDeFuente('')).toBeNull();
  });
});

describe('nombrePublicoFuente', () => {
  it('normalizes what it knows and leaves the rest intact', () => {
    expect(nombrePublicoFuente('AEMET_HTML')).toBe('AEMET');
    expect(nombrePublicoFuente('Meteovecino')).toBe('Meteovecino');
  });
});

describe('mismaFuente', () => {
  it('sees through the transport suffix', () => {
    expect(mismaFuente('AEMET_HTML', 'AEMET')).toBe(true);
    expect(mismaFuente('OpenWeather', 'Open-Meteo')).toBe(false);
  });

  it('an absent source is never "the same" as another', () => {
    expect(mismaFuente(null, 'AEMET')).toBe(false);
    expect(mismaFuente(undefined, undefined)).toBe(false);
  });
});
