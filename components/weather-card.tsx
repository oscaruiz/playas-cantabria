import {
  Thermometer,
  Droplets,
  Wind,
  Waves,
  Sun,
  ShieldAlert,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PrediccionDia, DatosClima } from "@/lib/api"

function WeatherRow({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType
  label: string
  value: string | number | undefined
  accent?: boolean
}) {
  if (value === undefined || value === null) return null

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function WeatherCard({
  dia,
  title,
  dateLabel,
  lastUpdated,
  fuente,
  defaultOpen = true,
}: {
  dia: PrediccionDia
  title: string
  dateLabel?: string
  lastUpdated?: string
  fuente?: string
  defaultOpen?: boolean
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl bg-card ring-1 ring-border/60 shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3.5 select-none list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {dateLabel && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {dateLabel}
            </span>
          )}
        </div>
        <svg
          className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </summary>

      <div className="border-t border-border px-4 pb-4 pt-1">
        {/* Summary row */}
        {dia.summary && (
          <div className="mt-2 rounded-lg bg-sky px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">
              {dia.summary}
            </p>
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-x-4">
          <WeatherRow
            icon={Thermometer}
            label="Temperatura"
            value={dia.temperature !== undefined ? `${dia.temperature} C` : undefined}
            accent
          />
          <WeatherRow
            icon={Droplets}
            label="Agua"
            value={
              dia.waterTemperature !== undefined
                ? `${dia.waterTemperature} C`
                : undefined
            }
            accent
          />
          <WeatherRow
            icon={Thermometer}
            label="Sensacion"
            value={dia.sensation}
          />
          <WeatherRow
            icon={Wind}
            label="Viento"
            value={dia.wind}
          />
          <WeatherRow
            icon={Waves}
            label="Oleaje"
            value={dia.waves}
          />
          {dia.uvIndex !== undefined && (
            <WeatherRow
              icon={Sun}
              label="Indice UV"
              value={dia.uvIndex}
            />
          )}
        </div>

        {/* Meta */}
        {(lastUpdated || fuente) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            {lastUpdated && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(lastUpdated).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            {fuente && (
              <span className="text-[11px] text-muted-foreground">
                Fuente: {fuente}
              </span>
            )}
          </div>
        )}
      </div>
    </details>
  )
}
