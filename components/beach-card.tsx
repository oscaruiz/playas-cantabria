import Link from "next/link"
import { MapPin, Shield } from "lucide-react"
import type { Playa } from "@/lib/api"

export function BeachCard({ playa }: { playa: Playa }) {
  const isVigilada = playa.idCruzRoja && playa.idCruzRoja > 0

  return (
    <Link
      href={`/playa/${playa.codigo}`}
      className="group block rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/60 transition-all hover:shadow-md hover:ring-primary/30 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {playa.nombre}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{playa.municipio}</span>
          </p>
        </div>

        {isVigilada && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-flag-green/10 px-2.5 py-1 text-xs font-medium text-flag-green">
            <Shield className="h-3 w-3" />
            <span className="sr-only sm:not-sr-only">Cruz Roja</span>
          </span>
        )}
      </div>
    </Link>
  )
}
