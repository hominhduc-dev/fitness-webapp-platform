"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function ShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isTraineeHub = pathname === "/coach/trainees" || pathname.startsWith("/coach/trainees/")
  return (
    <main className={cn("flex-1 pt-[env(safe-area-inset-top)] pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]", isTraineeHub ? "overflow-clip" : "overflow-auto")}>
      {children}
    </main>
  )
}
