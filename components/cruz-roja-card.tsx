import { Shield, Clock, CalendarDays } from "lucide-react"
import type { DatosCruzRoja } from "@/lib/api"

export function CruzRojaCard({ data }: { data: DatosCruzRoja }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border/60 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
          <Shield className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Cruz Roja</h3>
      </div>

      <div className="flex flex-col gap-2.5">
        {data.coberturaDesde && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>
              Cobertura: {data.coberturaDesde}
              {data.coberturaHasta ? ` - ${data.coberturaHasta}` : ""}
            </span>
          </div>
        )}
        {data.horario && (
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Horario: {data.horario}</span>
          </div>
        )}
      </div>
    </div>
  )
}
