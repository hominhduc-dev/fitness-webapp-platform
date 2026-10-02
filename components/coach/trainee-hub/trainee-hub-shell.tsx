"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The roster beside one trainee. From lg up both columns show; below it they
 * are two screens — the roster at /coach/trainees, the trainee at
 * /coach/trainees/[id] — so the phone's back gesture moves between them. The
 * layout keeps this mounted, so the roster keeps its scroll and search while
 * the coach moves from one trainee to the next.
 */
export function TraineeHubShell({ children, roster }: { children: ReactNode; roster: ReactNode }) {
  const hasDetail = useSelectedLayoutSegment() !== null

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 pb-6 pt-page md:px-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={cn("min-w-0", hasDetail && "hidden lg:block")}>{roster}</aside>
      <section className={cn("@container min-w-0", !hasDetail && "hidden lg:block")}>{children}</section>
    </div>
  )
}
