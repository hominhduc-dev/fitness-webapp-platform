"use client"

import { useSelectedLayoutSegment } from "next/navigation"
import type { ReactNode } from "react"
import { PanelLeftClose, PanelLeftOpen, Users } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { usePersistedCollapse } from "@/components/layout/use-persisted-collapse"
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
  const [collapsed, toggleCollapsed] = usePersistedCollapse("yeahbuddy-coach-roster-collapsed")
  const { messages } = useLocale()
  const isCollapsed = hasDetail && collapsed
  const toggleLabel = isCollapsed ? messages.traineeHub.expandList : messages.traineeHub.collapseList

  return (
    <div className={cn(
      "mx-auto w-full max-w-[1500px] px-3 pb-6 pt-page md:px-6 lg:grid lg:items-start lg:gap-5",
      isCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]",
    )}>
      <aside className={cn("min-w-0 lg:sticky lg:top-4 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-sm", hasDetail && "hidden lg:block")}>
        {hasDetail ? (
          <div className={cn("hidden p-2 lg:flex", isCollapsed ? "justify-center" : "justify-end")}>
            <Button type="button" variant="ghost" size="icon" className="group/roster-toggle relative rounded-xl" aria-label={toggleLabel} title={toggleLabel} aria-expanded={!isCollapsed} aria-controls="trainee-hub-roster" onClick={toggleCollapsed}>
              {isCollapsed ? <>
                <Users aria-hidden="true" className="group-hover/roster-toggle:opacity-0 group-focus-visible/roster-toggle:opacity-0" />
                <PanelLeftOpen aria-hidden="true" className="absolute opacity-0 group-hover/roster-toggle:opacity-100 group-focus-visible/roster-toggle:opacity-100" />
              </> : <PanelLeftClose aria-hidden="true" />}
            </Button>
          </div>
        ) : null}
        <div id="trainee-hub-roster">{roster}</div>
      </aside>
      <section className={cn("@container min-w-0", !hasDetail && "hidden lg:block")}>{children}</section>
    </div>
  )
}
