import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { CoachTraineeDetailClient } from "@/components/coach/trainee-detail-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms, fetchCoachTraineeDetail } from "@/lib/fitness/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

/** Derive a rough status from trainee data for the status badge. */
function deriveStatus(trainee: {
  completionRate?: number
  thisWeekWorkouts: number
  plannedSessionsPerWeek?: number
}): "on-track" | "behind" | "rest" {
  const planned = trainee.plannedSessionsPerWeek ?? 0
  const completed = trainee.thisWeekWorkouts

  if (planned === 0 && completed === 0) return "rest"

  const rate = planned > 0 ? completed / planned : (trainee.completionRate ?? 0) / 100
  if (rate >= 0.8) return "on-track"
  if (rate === 0) return "rest"
  return "behind"
}

const STATUS_BADGE_CLASS: Record<"on-track" | "behind" | "rest", string> = {
  "on-track": "bg-success/10 text-success-text border-success/20",
  "behind": "bg-warning-soft text-warning-text border-warning/20",
  "rest": "bg-muted text-muted-foreground border-border",
}

function getStatusLabel(status: "on-track" | "behind" | "rest", messages: Awaited<ReturnType<typeof getServerMessages>>) {
  const statusLabel: Record<"on-track" | "behind" | "rest", string> = {
    "on-track": messages.coach.statusOnTrack,
    "behind": messages.coach.statusBehind,
    "rest": messages.coach.statusRestWeek,
  }

  return statusLabel[status]
}

export default async function TraineeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ accessToken }, locale, messages] = await Promise.all([
    requireAppSession({ role: "coach" }),
    getServerLocale(),
    getServerMessages(),
  ])
  const [detail, coachPrograms] = await Promise.all([
    fetchCoachTraineeDetail(accessToken, id),
    fetchCoachPrograms(accessToken),
  ])

  const status = deriveStatus(detail.trainee)
  const activeProgram = detail.programs[0]

  // Streak: use totalWorkoutLogs as a proxy when no explicit streak is available
  const streak = detail.trainee.thisWeekWorkouts

  const lastSeen = detail.trainee.lastCheckInAt
    ? detail.trainee.lastCheckInAt.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric" })
    : null

  return (
    <div className="mx-auto max-w-7xl px-3 pb-8 pt-page sm:px-5 lg:px-6" data-tour="coach-client-overview">
      <section className="mb-6 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg shadow-foreground/5 ring-1 ring-card/80">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-3 sm:px-5">
          <Link href="/coach/trainees" className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">{messages.coach.allClients}</span>
          </Link>
          <Badge variant="micro" className={STATUS_BADGE_CLASS[status]}>
            {getStatusLabel(status, messages)}
          </Badge>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-14 w-14 shrink-0 rounded-xl ring-4 ring-primary/10 md:h-16 md:w-16">
              <AvatarImage src={detail.trainee.avatar ?? undefined} />
              <AvatarFallback className="rounded-xl bg-muted text-lg font-semibold text-foreground md:text-xl">
                {getInitials(detail.trainee.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="mb-1 truncate font-mono text-micro uppercase tracking-[0.12em] text-muted-foreground">
                {activeProgram?.name ?? messages.coach.noProgramsAssigned}
              </p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground md:text-4xl md:leading-[1.05]">
                {detail.trainee.name}
              </h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {messages.coach.traineeWorkoutSummary(streak, lastSeen ?? undefined)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <div className="rounded-xl border border-primary/15 bg-primary-soft/50 px-3 py-2 shadow-sm">
              <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{messages.coach.thisWeek}</p>
              <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">
                {detail.trainee.thisWeekWorkouts}/{detail.trainee.plannedSessionsPerWeek ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary-soft/50 px-3 py-2 shadow-sm">
              <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{messages.coach.completion}</p>
              <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">
                {Math.round(detail.trainee.completionRate ?? 0)}%
              </p>
            </div>
          </div>
        </div>
      </section>

      <CoachTraineeDetailClient coachPrograms={coachPrograms} initialDetail={detail} />
    </div>
  )
}
