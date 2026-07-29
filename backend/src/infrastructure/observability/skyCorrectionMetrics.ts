import { DecisionCielo, MotivoDecision } from '../../domain/services/skyCorrection';

/**
 * Contadores del corrector de cielo, para poder decidir con datos si se enciende.
 *
 * En modo `shadow` la respuesta no cambia, así que sin esto no habría forma de
 * saber cuántas veces habría corregido ni con qué estación. Se contrasta con las
 * webcams de las playas que las tienen.
 *
 * Acotado a propósito: el proceso vive en 512 MB y solo hay 46 playas, así que se
 * guarda la ÚLTIMA decisión de cada una, no un histórico.
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
      // Redondeado: el km exacto no aporta y ensucia la lectura del diagnóstico.
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
