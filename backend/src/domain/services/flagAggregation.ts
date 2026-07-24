import { FlagStatus, FlagColor } from '../entities/Flag';
import { CruzRojaStation } from '../entities/Beach';

/**
 * Regla de agregación de banderas para una playa con VARIOS puestos de Cruz Roja.
 *
 * Determinista y CONSERVADORA: se muestra la bandera MÁS RESTRICTIVA de entre los
 * puestos que tienen color real izado. Severidad (mayor = más restrictiva):
 *   negra (4) > roja (3) > amarilla (2) > verde (1)
 *
 * Principios:
 *  - Un puesto SIN color (sin cobertura / "no hay información") NO cuenta como
 *    verde: no puede rebajar ni "aprobar" la bandera. Simplemente no aporta color.
 *  - Los estados individuales se conservan por el llamador si los necesita; esta
 *    función solo decide la bandera agregada a mostrar.
 *  - Si NINGÚN puesto tiene color, se devuelve el primer estado con
 *    cobertura/horario (mejor que nada), o null si no hay ninguno.
 */
const SEVERITY: Record<Exclude<FlagColor, 'unknown'>, number> = {
  green: 1,
  yellow: 2,
  red: 3,
  black: 4,
};

export function aggregateFlags(flags: Array<FlagStatus | null>): FlagStatus | null {
  const present = flags.filter((f): f is FlagStatus => f != null);
  if (present.length === 0) return null;

  const withColor = present.filter(
    (f): f is FlagStatus & { color: Exclude<FlagColor, 'unknown'> } =>
      f.color != null && f.color !== 'unknown'
  );

  if (withColor.length === 0) {
    // Ningún puesto con bandera izada: devolver el estado más informativo
    // (con cobertura/horario) para conservar la información de vigilancia.
    return present.find((f) => f.coverageFrom || f.schedule) ?? present[0];
  }

  // Puesto con la bandera más restrictiva (desempate: el más reciente).
  return withColor.reduce((worst, cur) => {
    const dSev = SEVERITY[cur.color] - SEVERITY[worst.color];
    if (dSev > 0) return cur;
    if (dSev === 0 && cur.timestamp > worst.timestamp) return cur;
    return worst;
  });
}

/**
 * Resuelve la bandera de una playa a partir de sus puestos:
 *  - varios puestos con id → consulta todos (getFlag, ya seguro) y agrega.
 *  - si no, usa el `redCrossId` único (camino legado).
 * `getFlag` debe ser una función que NO lanza (devuelve null ante fallo).
 */
export async function resolveFlagForStations(
  redCrossId: number | undefined,
  stations: CruzRojaStation[] | undefined,
  getFlag: (id: number) => Promise<FlagStatus | null>,
): Promise<FlagStatus | null> {
  const ids = (stations ?? [])
    .map((s) => s.id)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  if (ids.length > 0) {
    return aggregateFlags(await Promise.all(ids.map((id) => getFlag(id))));
  }
  if (redCrossId && redCrossId > 0) return getFlag(redCrossId);
  return null;
}
