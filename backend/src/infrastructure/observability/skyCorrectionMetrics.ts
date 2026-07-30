import { DecisionCielo, MotivoDecision } from '../../domain/services/skyCorrection';

/**
 * Counters for the sky corrector, to be able to decide with data whether to turn it on.
 *
 * In `shadow` mode the response does not change, so without this there would be no
 * way to know how many times it would have corrected or with which station. It is checked
 * against the webcams of the beaches that have them.
 *
 * Bounded on purpose: the process lives in 512 MB and there are only 46 beaches, so
 * the LAST decision of each one is stored, not a history.
 */
export interface UltimaDecision {
  playa: string;
  motivo: MotivoDecision;
  nivel?: string;
  idema?: string;
  distanciaKm?: number;
  fraccion?: number;
  cuando: string;
}

export class SkyCorrectionMetrics {
  private porMotivo = new Map<MotivoDecision, number>();
  private ultimaPorPlaya = new Map<string, UltimaDecision>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  record(playa: string, decision: DecisionCielo): void {
    this.porMotivo.set(decision.motivo, (this.porMotivo.get(decision.motivo) ?? 0) + 1);
    this.ultimaPorPlaya.set(playa, {
      playa,
      motivo: decision.motivo,
      nivel: decision.nivel,
      idema: decision.idema,
      // Rounded: the exact km adds nothing and clutters the diagnostic readout.
      distanciaKm: decision.distanciaKm != null ? Math.round(decision.distanciaKm) : undefined,
      fraccion: decision.fraccion != null ? Number(decision.fraccion.toFixed(2)) : undefined,
      cuando: new Date(this.now()).toISOString(),
    });
  }

  snapshot() {
    const motivos = Object.fromEntries(this.porMotivo);
    const total = Object.values(motivos).reduce((a, b) => a + b, 0);
    return {
      total,
      motivos,
      corregidas: [...this.ultimaPorPlaya.values()]
        .filter((d) => d.motivo === 'corregido')
        .sort((a, b) => a.playa.localeCompare(b.playa)),
      ultimaPorPlaya: [...this.ultimaPorPlaya.values()].sort((a, b) =>
        a.playa.localeCompare(b.playa),
      ),
    };
  }

  reset(): void {
    this.porMotivo.clear();
    this.ultimaPorPlaya.clear();
  }
}

export const skyCorrectionMetrics = new SkyCorrectionMetrics();
