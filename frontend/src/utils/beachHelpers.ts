/**
 * Shared beach helper functions used by HomePage, PlayaDetalle, and other pages.
 */

export function limpiarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto.replace(/\uFFFD/g, 'e');
}

export function flagColorClass(bandera?: string): string {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('roja')) return 'red';
  if (b.includes('amarilla')) return 'yellow';
  if (b.includes('verde')) return 'green';
  return 'unknown';
}

export function flagDisplayText(bandera?: string): string {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('roja')) return 'Bandera Roja';
  if (b.includes('amarilla')) return 'Bandera Amarilla';
  if (b.includes('verde')) return 'Bandera Verde';
  return 'Sin datos';
}

export function isFlagAvailable(cruzRoja?: { bandera?: string }): boolean {
  if (!cruzRoja) return false;
  const b = cruzRoja.bandera?.toLowerCase() || '';
  return b.includes('roja') || b.includes('amarilla') || b.includes('verde');
}

export function capitalizar(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const ATTR_CONFIG: Record<string, { emoji: string; label: string }> = {
  duchas:        { emoji: '\u{1F6BF}', label: 'Duchas' },
  aseos:         { emoji: '\u{1F6BB}', label: 'Aseos' },
  parking:       { emoji: '\u{1F17F}\uFE0F', label: 'Parking' },
  accesible:     { emoji: '\u267F', label: 'Accesible' },
  chiringuito:   { emoji: '\u{1F379}', label: 'Chiringuito' },
  surf:          { emoji: '\u{1F3C4}', label: 'Surf' },
  mascotas:      { emoji: '\u{1F415}', label: 'Mascotas' },
  socorrismo:    { emoji: '\u{1F6DF}', label: 'Socorrismo' },
  nudista:       { emoji: '\u{1F3D6}\uFE0F', label: 'Nudista' },
  accesoBanista: { emoji: '\u{1F3CA}', label: 'Acceso ba\u00F1o' },
};

/** Returns active attribute entries from a beach's atributos object */
export function getActiveAttrs(atributos?: Record<string, boolean | undefined> | null): Array<{ key: string; emoji: string; label: string }> {
  if (!atributos) return [];
  return Object.entries(atributos)
    .filter(([key, val]) => val === true && ATTR_CONFIG[key])
    .map(([key]) => ({ key, ...ATTR_CONFIG[key] }));
}

export function emojiCielo(cielo: string | null): string {
  if (!cielo) return '\u26C5';
  const c = cielo.toLowerCase();
  if (/despejado|soleado/.test(c)) return '\u2600\uFE0F';
  if (/poco nuboso|intervalos|parcial|claro/.test(c)) return '\u{1F324}\uFE0F';
  if (/muy nuboso|cubierto/.test(c)) return '\u2601\uFE0F';
  if (/nuboso|nublado/.test(c)) return '\u26C5';
  if (/tormenta|el[eé]ctrica|rayos/.test(c)) return '\u26C8\uFE0F';
  if (/lluvia|llovizna|chubascos/.test(c)) return '\u{1F327}\uFE0F';
  if (/nieve|nevada|aguanieve/.test(c)) return '\u{1F328}\uFE0F';
  if (/niebla|bruma|neblina/.test(c)) return '\u{1F32B}\uFE0F';
  return '\u26C5';
}
