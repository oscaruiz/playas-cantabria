import { getPlayas } from "@/lib/api"
import { BeachList } from "@/components/beach-list"
import { Waves } from "lucide-react"

export default async function HomePage() {
  let playas
  try {
    playas = await getPlayas()
  } catch {
    playas = []
  }

  // Sort alphabetically by name
  const sorted = [...playas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-primary shadow-md">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-2.5 px-4 py-4">
          <Waves className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          <h1 className="text-lg font-bold tracking-tight text-primary-foreground">
            Playas de Cantabria
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg px-4 py-5">
        <BeachList playas={sorted} />
      </main>
    </div>
  )
}
