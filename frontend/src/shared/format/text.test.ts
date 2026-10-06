import { capitalize, cleanText } from './text';

describe('capitalizar', () => {
  it('uppercases the first letter and leaves the rest intact', () => {
    expect(capitalize('despejado')).toBe('Despejado');
    expect(capitalize('mar de fondo')).toBe('Mar de fondo');
  });

  it('empty string for anything that is not text', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
    expect(capitalize(undefined)).toBe('');
  });
});

describe('cleanText', () => {
  it('replaces the replacement character left by mojibake', () => {
    expect(cleanText('caf\uFFFD')).toBe('cafe');
    expect(cleanText('d\uFFFDbil, mar\uFFFDjada')).toBe('debil, marejada');
  });

  it('leaves correct text intact and returns "" when there is no data', () => {
    expect(cleanText('Marejadilla')).toBe('Marejadilla');
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
  });
});
