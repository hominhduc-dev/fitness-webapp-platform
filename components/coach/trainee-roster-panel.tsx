"use client"

import Link from "next/link"
import { ChevronRight, Search } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import type { CoachTrainee } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

type TraineeRosterPanelProps = {
  activeTraineeId: string
  trainees: CoachTrainee[]
}

type RosterStatus = "on-track" | "behind" | "rest"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
}

function getStatus(trainee: CoachTrainee): RosterStatus {
  const planned = trainee.plannedSessionsPerWeek ?? 0
  if (planned <= 0) return "rest"
  return trainee.thisWeekWorkouts / planned >= 0.8 ? "on-track" : "behind"
}

const STATUS_DOT_CLASS: Record<RosterStatus, string> = {
  "on-track": "bg-success",
  behind: "bg-warning",
  rest: "bg-muted-foreground/40",
}

export function TraineeRosterPanel({ activeTraineeId, trainees }: TraineeRosterPanelProps) {
  const { messages } = useLocale()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")

  const currentTab = searchParams.get("tab")
  const normalizedQuery = query.trim().toLowerCase()
  const visibleTrainees = useMemo(
    () =>
      trainees.filter((trainee) => {
        if (!normalizedQuery) return true
        return [trainee.name, trainee.email, trainee.phone ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        )
      }),
    [normalizedQuery, trainees],
  )

  return (
    <aside className="sticky top-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md shadow-foreground/5 ring-1 ring-card/70">
      <div className="border-b border-border/70 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {messages.coach.traineeList}
          </h2>
          <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
            {messages.coach.clientTotal(trainees.length)}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={messages.coach.searchClients}
            className="h-10 pl-9"
            aria-label={messages.coach.searchClients}
          />
        </div>
      </div>

      <div className="max-h-[calc(100dvh-170px)] overflow-y-auto p-2">
        {visibleTrainees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
            {messages.coach.noClientsMatch}
          </p>
        ) : (
          <div className="space-y-1">
            {visibleTrainees.map((trainee) => {
              const status = getStatus(trainee)
              const isActive = trainee.id === activeTraineeId
              const completion = Math.round(
                trainee.completionRate ??
                  ((trainee.plannedSessionsPerWeek ?? 0) > 0
                    ? (trainee.thisWeekWorkouts / (trainee.plannedSessionsPerWeek ?? 1)) * 100
                    : 0),
              )
              const href = currentTab
                ? `/coach/trainees/${trainee.id}?tab=${encodeURIComponent(currentTab)}`
                : `/coach/trainees/${trainee.id}`

              return (
                <Link
                  key={trainee.id}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
                    isActive
                      ? "border-primary/20 bg-primary-soft/70"
                      : "border-transparent hover:border-border hover:bg-muted/40",
                  )}
                >
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={trainee.avatar ?? undefined} />
                    <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                      {getInitials(trainee.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{trainee.name}</p>
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT_CLASS[status])}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {trainee.programCount > 0
                        ? messages.coach.traineeProgramCount(trainee.programCount)
                        : messages.coach.noProgram}
                    </p>
                    <p className="mt-1 font-mono text-micro tabular-nums text-muted-foreground">
                      {`${completion}% · ${messages.coach.thisWeek}`}
                    </p>
                  </div>

                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
