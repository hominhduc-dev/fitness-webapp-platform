import Link from "next/link"
import { ChevronRight, Search, Users } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachTrainees } from "@/lib/fitness/api"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

type TraineesPageProps = {
  searchParams?: Promise<{ phone?: string | string[]; filter?: string | string[] }> | { phone?: string | string[]; filter?: string | string[] }
}

function getPhoneQuery(value?: string | string[]) {
  if (typeof value === "string") {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : ""
  }

  return ""
}

function getFilterQuery(value?: string | string[]) {
  if (typeof value === "string") {
    return value.trim()
  }
  return "all"
}

/** Derive a rough status from trainee data for the status dot. */
function deriveStatus(trainee: {
  completionRate?: number
  thisWeekWorkouts: number
  plannedSessionsPerWeek?: number
  lastCheckInAt?: Date
}): "on-track" | "behind" | "rest" {
  const planned = trainee.plannedSessionsPerWeek ?? 0
  const completed = trainee.thisWeekWorkouts

  if (planned === 0 && completed === 0) {
    return "rest"
  }

  const rate = planned > 0 ? completed / planned : (trainee.completionRate ?? 0) / 100
  if (rate >= 0.8) return "on-track"
  if (rate === 0) return "rest"
  return "behind"
}

const STATUS_DOT: Record<"on-track" | "behind" | "rest", string> = {
  "on-track": "bg-success",
  "behind": "bg-amber-500",
  "rest": "bg-muted-foreground/40",
}

const STATUS_LABEL: Record<"on-track" | "behind" | "rest", string> = {
  "on-track": "On track",
  "behind": "Behind",
  "rest": "Rest week",
}

const FILTER_CHIPS = [
  { key: "all", label: "All" },
  { key: "on-track", label: "On track" },
  { key: "behind", label: "Behind" },
  { key: "rest", label: "Rest week" },
] as const

export default async function TraineesPage({ searchParams }: TraineesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const phoneQuery = getPhoneQuery(resolvedSearchParams?.phone)
  const activeFilter = getFilterQuery(resolvedSearchParams?.filter)
  const { accessToken } = await requireAppSession({ role: "coach" })
  const trainees = await fetchCoachTrainees(accessToken, {
    phone: phoneQuery,
  })

  const statusedTrainees = trainees.map((t) => ({ ...t, _status: deriveStatus(t) }))

  const filteredTrainees =
    activeFilter === "all"
      ? statusedTrainees
      : statusedTrainees.filter((t) => t._status === activeFilter)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Page header */}
      <div className="mb-5 flex items-baseline justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {trainees.length} total
        </span>
      </div>

      {/* Search + filter bar */}
      <div className="mb-4 space-y-3 border-b border-border pb-4">
        <form className="relative">
          <Search className="absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            name="phone"
            defaultValue={phoneQuery}
            placeholder="Search by phone number..."
            className="pl-9"
          />
        </form>
        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {FILTER_CHIPS.map(({ key, label }) => (
            <Link
              key={key}
              href={phoneQuery ? `/coach/trainees?phone=${encodeURIComponent(phoneQuery)}&filter=${key}` : `/coach/trainees?filter=${key}`}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                activeFilter === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Trainee list */}
      {filteredTrainees.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {phoneQuery ? "No clients matched this phone number." : "No clients yet. Start one."}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {filteredTrainees.map((trainee) => {
            const status = trainee._status
            const program = trainee.assignedProgramIds && trainee.programCount > 0
              ? `${trainee.programCount} program${trainee.programCount !== 1 ? "s" : ""}`
              : "No program"
            const lastSeen = trainee.lastCheckInAt
              ? `Check-in ${trainee.lastCheckInAt.toLocaleDateString()}`
              : `Joined ${trainee.createdAt.toLocaleDateString()}`

            return (
              <Link
                key={trainee.id}
                href={`/coach/trainees/${trainee.id}`}
                className={cn(
                  "group flex items-center gap-3 border-l-[3px] px-6 py-[14px] transition-colors hover:bg-muted/50",
                  "border-l-transparent first:rounded-t-lg last:rounded-b-lg",
                )}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={trainee.avatar ?? undefined} />
                  <AvatarFallback className="bg-muted text-[13px] font-medium text-foreground">
                    {getInitials(trainee.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {trainee.name}
                    </span>
                    <span
                      className={cn(
                        "h-[6px] w-[6px] shrink-0 rounded-full",
                        STATUS_DOT[status],
                      )}
                      title={STATUS_LABEL[status]}
                    />
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {program} · {lastSeen}
                  </div>
                </div>

                <ChevronRight className="h-[14px] w-[14px] shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
