"use client"

import { useState, useMemo } from "react"
import type { Playa } from "@/lib/api"
import { BeachSearch } from "./beach-search"
import { BeachCard } from "./beach-card"
import { Waves } from "lucide-react"

export function BeachList({ playas }: { playas: Playa[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return playas
    return playas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.municipio.toLowerCase().includes(q)
    )
  }, [playas, query])

  return (
    <div className="flex flex-col gap-4">
      <BeachSearch value={query} onChange={setQuery} />

      {/* Result count */}
      <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase px-1">
        {filtered.length} {filtered.length === 1 ? "playa" : "playas"}
        {query && " encontradas"}
      </p>

      {/* Beach cards */}
      <div className="flex flex-col gap-2.5">
        {filtered.map((playa) => (
          <BeachCard key={playa.codigo} playa={playa} />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Waves className="h-10 w-10 opacity-40" />
            <p className="text-sm">No se encontraron playas</p>
          </div>
        )}
      </div>
    </div>
  )
}
