"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Waves } from "lucide-react"

export function BeachDetailHeader({ nombre }: { nombre: string }) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-30 bg-primary shadow-md">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3.5">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-primary-foreground/20"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Waves className="h-5 w-5 shrink-0 text-primary-foreground" aria-hidden="true" />
          <h1 className="truncate text-sm font-semibold text-primary-foreground">
            {nombre}
          </h1>
        </div>
      </div>
    </header>
  )
}
