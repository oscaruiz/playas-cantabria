"use client"

import { Search } from "lucide-react"
import { useRef } from "react"

export function BeachSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar playa o municipio..."
        className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
        aria-label="Buscar playa o municipio"
      />
    </div>
  )
}
