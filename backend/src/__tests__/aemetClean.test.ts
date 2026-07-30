import { describe, it, expect } from 'vitest';
import { clean } from '../infrastructure/providers/AemetBeachWebScraper';

describe('AEMET clean() — normaliza el centinela "nd" (no disponible)', () => {
  it('convierte "nd" (en cualquier caja) a null', () => {
    // AEMET emits "nd" in sky/wind/waves when it has not yet published the
    // day's forecast; it must NOT reach the UI as literal text.
    expect(clean('nd')).toBeNull();
    expect(clean('ND')).toBeNull();
    expect(clean('  nd  ')).toBeNull();
  });

  it('null/undefined/vacío → null', () => {
    expect(clean(null)).toBeNull();
    expect(clean(undefined)).toBeNull();
    expect(clean('   ')).toBeNull();
  });

  it('conserva descripciones reales (incluidas las que contienen las letras n/d)', () => {
    expect(clean('Despejado')).toBe('Despejado');
    expect(clean('Nuboso')).toBe('Nuboso');
    expect(clean('Viento del nordeste')).toBe('Viento del nordeste'); // "nd" not isolated
    expect(clean('  Marejadilla ')).toBe('Marejadilla');
  });
});
