import { capitalize, cleanText } from './texto';

describe('capitalizar', () => {
  it('sube la primera letra y deja el resto intacto', () => {
    expect(capitalize('despejado')).toBe('Despejado');
    expect(capitalize('mar de fondo')).toBe('Mar de fondo');
  });

  it('cadena vacía para lo que no es texto', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
    expect(capitalize(undefined)).toBe('');
  });
});

describe('limpiarTexto', () => {
  it('sustituye el carácter de reemplazo que deja el mojibake', () => {
    expect(cleanText('caf\uFFFD')).toBe('cafe');
    expect(cleanText('d\uFFFDbil, mar\uFFFDjada')).toBe('debil, marejada');
  });

  it('deja intacto el texto correcto y devuelve "" sin dato', () => {
    expect(cleanText('Marejadilla')).toBe('Marejadilla');
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
  });
});
