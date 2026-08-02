import { capitalizar, limpiarTexto } from './texto';

describe('capitalizar', () => {
  it('sube la primera letra y deja el resto intacto', () => {
    expect(capitalizar('despejado')).toBe('Despejado');
    expect(capitalizar('mar de fondo')).toBe('Mar de fondo');
  });

  it('cadena vacía para lo que no es texto', () => {
    expect(capitalizar('')).toBe('');
    expect(capitalizar(null)).toBe('');
    expect(capitalizar(undefined)).toBe('');
  });
});

describe('limpiarTexto', () => {
  it('sustituye el carácter de reemplazo que deja el mojibake', () => {
    expect(limpiarTexto('caf\uFFFD')).toBe('cafe');
    expect(limpiarTexto('d\uFFFDbil, mar\uFFFDjada')).toBe('debil, marejada');
  });

  it('deja intacto el texto correcto y devuelve "" sin dato', () => {
    expect(limpiarTexto('Marejadilla')).toBe('Marejadilla');
    expect(limpiarTexto(null)).toBe('');
    expect(limpiarTexto(undefined)).toBe('');
  });
});
