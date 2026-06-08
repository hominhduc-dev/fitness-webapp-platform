"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Search } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CoachTrainee } from "@/lib/fitness/types"
import type { AppMessages } from "@/lib/i18n/messages"

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
}

type Status = "on-track" | "behind" | "rest"

function deriveStatus(t: CoachTrainee): Status {
  const planned = t.plannedSessionsPerWeek ?? 0
  const done = t.thisWeekWorkouts
  if (planned === 0 && done === 0) return "rest"
  const rate = planned > 0 ? done / planned : (t.completionRate ?? 0) / 100
  if (rate >= 0.8) return "on-track"
  if (rate === 0) return "rest"
  return "behind"
}

const STATUS_COLOR: Record<Status, string> = {
  "on-track": "var(--success)",
  behind: "var(--warning)",
  rest: "color-mix(in srgb, var(--muted-foreground) 40%, transparent)",
}

const FILTERS = ["all", "on-track", "behind", "rest"] as const

function getStatusLabel(status: Status, messages: AppMessages) {
  if (status === "on-track") return messages.coach.statusOnTrack
  if (status === "behind") return messages.coach.statusBehind
  return messages.coach.statusRestWeek
}

function getFilterLabel(filter: (typeof FILTERS)[number], messages: AppMessages) {
  if (filter === "all") return messages.coach.allFilter
  if (filter === "rest") return messages.coach.rest
  return getStatusLabel(filter, messages)
}

/* ------------------------------------------------------------------ */
/* ClientRow                                                            */
/* ------------------------------------------------------------------ */

function ClientRow({ trainee }: { trainee: CoachTrainee }) {
  const { locale, messages } = useLocale()
  const status = deriveStatus(trainee)
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const program = trainee.programCount > 0
    ? messages.coach.traineeProgramCount(trainee.programCount)
    : messages.coach.noProgram
  const lastSeen = trainee.lastCheckInAt
    ? trainee.lastCheckInAt.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })
    : trainee.createdAt.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })

  return (
    <Link
      href={`/coach/trainees/${trainee.id}`}
      className="flex w-full items-center gap-3 border-b border-border border-l-[3px] border-l-transparent px-6 py-[14px] transition-colors hover:bg-muted/30"
    >
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={trainee.avatar ?? undefined} />
        <AvatarFallback className="bg-muted text-[13px] font-medium text-foreground">
          {getInitials(trainee.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{trainee.name}</span>
          <span
            className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
            style={{ background: STATUS_COLOR[status] }}
            title={getStatusLabel(status, messages)}
          />
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
          {program} · {lastSeen}
        </div>
      </div>

      <ChevronRight className="h-[14px] w-[14px] flex-shrink-0 text-muted-foreground" />
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* TraineesClientView (main export)                                     */
/* ------------------------------------------------------------------ */

type Props = {
  initialTrainees: CoachTrainee[]
}

export function TraineesClientView({ initialTrainees }: Props) {
  const { messages } = useLocale()
  const [trainees] = useState(initialTrainees)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"all" | "on-track" | "behind" | "rest">("all")

  const statusedTrainees = trainees.map((t) => ({ ...t, _status: deriveStatus(t) }))
  const visible = statusedTrainees.filter((t) => {
    if (filter !== "all" && t._status !== filter) return false
    if (q && !t.name.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header */}
      <div className="border-b border-border px-6 pb-3 pt-5">
        <div className="mb-3.5 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{messages.coach.clients}</h1>
          <span className="label-micro text-muted-foreground tnum">
            {messages.coach.clientTotal(trainees.length)}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-[11px] h-[14px] w-[14px] text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={messages.coach.searchClients}
            className="pl-9"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                filter === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {getFilterLabel(key, messages)}
            </button>
          ))}
        </div>
      </div>

      {/* Client rows */}
      <div>
        {visible.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            {messages.coach.noClientsMatch}
          </p>
        ) : (
          visible.map((t) => <ClientRow key={t.id} trainee={t} />)
        )}
      </div>
    </div>
  )
}
