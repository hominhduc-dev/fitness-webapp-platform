import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { CoachTraineeDetailClient } from "@/components/coach/trainee-detail-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  "on-track": "bg-success/10 text-success border-success/20",
  "behind": "bg-amber-500/10 text-amber-600 border-amber-500/20",
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
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Back nav */}
      <div className="mb-5 flex items-center gap-2">
        <Link href="/coach/trainees">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <span className="text-sm text-muted-foreground">{messages.coach.allClients}</span>
      </div>

      {/* Client header */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarImage src={detail.trainee.avatar ?? undefined} />
          <AvatarFallback className="bg-muted text-lg font-medium text-foreground">
            {getInitials(detail.trainee.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          {activeProgram && (
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {activeProgram.name}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {detail.trainee.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="micro"
              className={STATUS_BADGE_CLASS[status]}
            >
              {getStatusLabel(status, messages)}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {messages.coach.traineeWorkoutSummary(streak, lastSeen ?? undefined)}
            </span>
          </div>
        </div>
      </div>

      {/* Detail tabs (overview, progress, metrics, check-ins, logs) */}
      <CoachTraineeDetailClient coachPrograms={coachPrograms} initialDetail={detail} />
    </div>
  )
}
