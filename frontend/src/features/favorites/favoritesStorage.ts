/**
 * Persistence of favorite beaches in localStorage — pure functions, no React.
 *
 * The stored shape is versioned ({ version: 1, beachCodes: [...] }) so a
 * future format change can migrate or discard cleanly instead of guessing.
 * Reading is defensive: anything that is not exactly the expected shape
 * (garbage JSON, another version, non-string entries) degrades to "no
 * favorites", never to a crash. Writing can fail (private mode, full quota)
 * and must never break the interaction — same contract as `guardarPlayas`
 * in `services/api.ts`.
 */

const CLAVE_FAVORITAS = 'playas:favoritas';
const VERSION_ACTUAL = 1;

interface AlmacenFavoritas {
  version: number;
  beachCodes: string[];
}

/** Deduplicated, order-preserving copy. */
function unicos(codigos: readonly string[]): string[] {
  return Array.from(new Set(codigos));
}

export function leerFavoritas(): string[] {
  try {
    const crudo = localStorage.getItem(CLAVE_FAVORITAS);
    if (!crudo) return [];
    const parsed: unknown = JSON.parse(crudo);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];
    const { version, beachCodes } = parsed as Partial<AlmacenFavoritas>;
    if (version !== VERSION_ACTUAL || !Array.isArray(beachCodes)) return [];
    return unicos(
      beachCodes.filter((c): c is string => typeof c === 'string' && c !== '')
    );
  } catch {
    return [];
  }
}

export function guardarFavoritas(codigos: readonly string[]): void {
  try {
    const almacen: AlmacenFavoritas = { version: VERSION_ACTUAL, beachCodes: unicos(codigos) };
    localStorage.setItem(CLAVE_FAVORITAS, JSON.stringify(almacen));
  } catch {
    // no persistence: the favorite lives on in memory for this session
  }
}
