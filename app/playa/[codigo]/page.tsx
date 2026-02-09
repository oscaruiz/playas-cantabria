import { getDetallePlaya } from "@/lib/api"
import { FlagBadge } from "@/components/flag-badge"
import { WeatherCard } from "@/components/weather-card"
import { CruzRojaCard } from "@/components/cruz-roja-card"
import { BeachDetailHeader } from "@/components/beach-detail-header"
import { MapPin, Thermometer, Droplets, Wind } from "lucide-react"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ codigo: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { codigo } = await params
  try {
    const datos = await getDetallePlaya(codigo)
    return {
      title: `${datos.nombre} - Playas de Cantabria`,
      description: `Estado de la playa ${datos.nombre} en ${datos.municipio}: banderas, clima y oleaje.`,
    }
  } catch {
    return { title: "Playa - Playas de Cantabria" }
  }
}

function formatDate(dia: { fecha?: number }, ultimaActualizacion?: string, offset = 0): string {
  // Try to extract date from fecha number (YYYYMMDD)
  if (dia.fecha) {
    const s = String(dia.fecha)
    const y = parseInt(s.slice(0, 4), 10)
    const m = parseInt(s.slice(4, 6), 10) - 1
    const d = parseInt(s.slice(6, 8), 10)
    const date = new Date(y, m, d)
    return date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
  }

  // Fallback: use ultimaActualizacion + offset
  if (ultimaActualizacion) {
    const base = new Date(ultimaActualizacion)
    base.setDate(base.getDate() + offset)
    return base.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
  }

  return ""
}

export default async function PlayaDetallePage({ params }: PageProps) {
  const { codigo } = await params
  let datos
  try {
    datos = await getDetallePlaya(codigo)
  } catch {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No se pudo cargar la informacion de la playa.</p>
      </div>
    )
  }

  const bandera = datos.cruzRoja?.bandera
  const showBandera = bandera && bandera !== "Desconocida"
  const clima = datos.clima

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <BeachDetailHeader nombre={datos.nombre} />

      {/* Content */}
      <main className="mx-auto max-w-lg px-4">
        {/* Beach name + municipality */}
        <div className="mt-4 mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-balance">
            {datos.nombre}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {datos.municipio}
          </p>
        </div>

        {/* Hero section: Flag + Key weather stats */}
        <section aria-label="Estado principal" className="mb-5">
          {/* Flag badge - most important */}
          {showBandera && <FlagBadge bandera={bandera} size="lg" />}
          {!showBandera && <FlagBadge bandera={undefined} size="lg" />}

          {/* Quick weather stats row */}
          {clima && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <QuickStat
                icon={Thermometer}
                label="Temp."
                value={`${clima.hoy.temperature}C`}
              />
              <QuickStat
                icon={Droplets}
                label="Agua"
                value={`${clima.hoy.waterTemperature}C`}
              />
              <QuickStat
                icon={Wind}
                label="Viento"
                value={clima.hoy.wind}
                truncate
              />
            </div>
          )}
        </section>

        {/* Detailed weather cards */}
        {clima && (
          <section aria-label="Prevision meteorologica" className="flex flex-col gap-3 mb-5">
            <WeatherCard
              dia={clima.hoy}
              title="Hoy"
              dateLabel={formatDate(clima.hoy, clima.ultimaActualizacion, 0)}
              lastUpdated={clima.ultimaActualizacion}
              fuente={clima.fuente}
              defaultOpen={true}
            />
            <WeatherCard
              dia={clima.manana}
              title="Manana"
              dateLabel={formatDate(clima.manana, clima.ultimaActualizacion, 1)}
              fuente={clima.fuente}
              defaultOpen={false}
            />
          </section>
        )}

        {/* Cruz Roja details */}
        {datos.cruzRoja && showBandera && (
          <section aria-label="Datos de Cruz Roja" className="mb-5">
            <CruzRojaCard data={datos.cruzRoja} />
          </section>
        )}
      </main>
    </div>
  )
}

function QuickStat({
  icon: Icon,
  label,
  value,
  truncate = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  truncate?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 ring-1 ring-border/60 shadow-sm">
      <Icon className="h-4 w-4 text-primary" />
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold text-foreground ${truncate ? "truncate max-w-full" : ""}`}>
        {value}
      </p>
    </div>
  )
}
