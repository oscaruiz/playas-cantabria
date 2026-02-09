import { cn } from "@/lib/utils"
import { Flag } from "lucide-react"

const FLAG_CONFIG: Record<
  string,
  { bg: string; text: string; label: string; border: string }
> = {
  verde: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Bandera Verde",
    border: "border-emerald-200",
  },
  amarilla: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Bandera Amarilla",
    border: "border-amber-200",
  },
  roja: {
    bg: "bg-red-50",
    text: "text-red-700",
    label: "Bandera Roja",
    border: "border-red-200",
  },
}

function resolveFlag(bandera?: string) {
  if (!bandera) return null
  const lower = bandera.toLowerCase()
  if (lower.includes("verde")) return FLAG_CONFIG.verde
  if (lower.includes("amarilla")) return FLAG_CONFIG.amarilla
  if (lower.includes("roja")) return FLAG_CONFIG.roja
  return null
}

export function FlagBadge({
  bandera,
  size = "lg",
}: {
  bandera?: string
  size?: "sm" | "lg"
}) {
  const config = resolveFlag(bandera)

  if (!config) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-muted-foreground">
        <Flag className="h-5 w-5" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide">Bandera</p>
          <p className="text-sm font-semibold">Sin datos</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        config.bg,
        config.text,
        config.border,
        size === "lg" && "px-5 py-4"
      )}
      role="status"
      aria-label={config.label}
    >
      <Flag
        className={cn("shrink-0", size === "lg" ? "h-7 w-7" : "h-5 w-5")}
      />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide opacity-70">
          Estado actual
        </p>
        <p
          className={cn(
            "font-bold",
            size === "lg" ? "text-lg" : "text-sm"
          )}
        >
          {config.label}
        </p>
      </div>
    </div>
  )
}
