// Plain build scripts live outside CRA's src tree; Jest can still load their
// side-effect-free validators directly.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateBeachCatalog, validateRegion } = require('../../scripts/region-validation.mjs');

export {};

const validRegion = {
  id: 'asturias',
  name: 'Asturias',
  branding: {
    appName: 'Playas de Asturias',
    shortName: 'Asturias',
    themeColor: '#123456',
    backgroundColor: '#abcdef',
    capacitorAppId: 'com.example.asturias',
  },
  map: { center: { lat: 43.4, lon: -5.8 }, zoom: 9 },
};

describe('regional build validation', () => {
  it('rejects a region whose id differs from its directory', () => {
    expect(() => validateRegion(validRegion, 'galicia')).toThrow('must match directory');
  });

  it('rejects beach codes that cannot form one URL segment', () => {
    expect(() => validateBeachCatalog([{
      nombre: 'Test', municipio: 'Test', codigo: 'bad/code', lat: 43.4, lon: -4,
    }], 'test')).toThrow('invalid format');
  });

  it('accepts URL-safe beach codes', () => {
    expect(() => validateBeachCatalog([{
      nombre: 'Test', municipio: 'Test', codigo: 'beach_1-foo.bar~x', lat: 43.4, lon: -4,
    }], 'test')).not.toThrow();
  });
});
