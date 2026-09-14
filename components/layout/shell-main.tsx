"use client"

import type { ReactNode } from "react"

export function ShellMain({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 overflow-auto pt-[env(safe-area-inset-top)] pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {children}
    </main>
  )
}
