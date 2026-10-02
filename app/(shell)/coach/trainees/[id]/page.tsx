import Link from "next/link"
import { ArrowLeft, Dumbbell, UserRound } from "lucide-react"

import { CoachTraineeDetailClient } from "@/components/coach/trainee-detail-client"
import { TraineeRosterPanel } from "@/components/coach/trainee-roster-panel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms, fetchCoachTraineeDetail, fetchCoachTrainees } from "@/lib/fitness/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
}

function deriveStatus(trainee: {
  completionRate?: number
  thisWeekWorkouts: number
  plannedSessionsPerWeek?: number
}): "on-track" | "behind" | "rest" {
  const planned = trainee.plannedSessionsPerWeek ?? 0
  const completed = trainee.thisWeekWorkouts

  if (planned <= 0) return "rest"

  const rate = planned > 0 ? completed / planned : (trainee.completionRate ?? 0) / 100
  return rate >= 0.8 ? "on-track" : "behind"
}

const STATUS_BADGE_CLASS: Record<"on-track" | "behind" | "rest", string> = {
  "on-track": "border-success/20 bg-success/10 text-success-text",
  behind: "border-warning/20 bg-warning-soft text-warning-text",
  rest: "border-border bg-muted text-muted-foreground",
}

function getStatusLabel(
  status: "on-track" | "behind" | "rest",
  messages: Awaited<ReturnType<typeof getServerMessages>>,
) {
  if (status === "on-track") return messages.coach.statusOnTrack
  if (status === "behind") return messages.coach.statusBehind
  return messages.coach.statusRestWeek
}

export default async function TraineeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ accessToken }, locale, messages] = await Promise.all([
    requireAppSession({ role: "coach" }),
    getServerLocale(),
    getServerMessages(),
  ])

  const [detail, coachPrograms, trainees] = await Promise.all([
    fetchCoachTraineeDetail(accessToken, id),
    fetchCoachPrograms(accessToken),
    fetchCoachTrainees(accessToken),
  ])

  const status = deriveStatus(detail.trainee)
  const activeProgram = detail.programs[0]
  const memberSince = detail.trainee.createdAt.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    year: "numeric",
  })

  return (
    <div className="mx-auto w-full max-w-[1480px] px-3 pb-8 pt-page sm:px-5 lg:px-6" data-tour="coach-client-overview">
      <header className="mb-4 px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {messages.coach.clients}
          </h1>
          <Badge variant="micro" className="border-primary/20 bg-primary-soft text-primary">
            COACH
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{messages.coach.subtitle}</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <main className="min-w-0">
          <section className="mb-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md shadow-foreground/5 ring-1 ring-card/70">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-2.5 xl:hidden">
              <Link
                href="/coach/trainees"
                className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{messages.coach.allClients}</span>
              </Link>
              <Badge variant="micro" className={STATUS_BADGE_CLASS[status]}>
                {getStatusLabel(status, messages)}
              </Badge>
            </div>

            <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <Avatar className="h-14 w-14 shrink-0 ring-4 ring-primary/10 sm:h-16 sm:w-16">
                  <AvatarImage src={detail.trainee.avatar ?? undefined} />
                  <AvatarFallback className="bg-muted text-lg font-semibold text-foreground">
                    {getInitials(detail.trainee.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                      {detail.trainee.name}
                    </h2>
                    <Badge variant="micro" className={STATUS_BADGE_CLASS[status]}>
                      {getStatusLabel(status, messages)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{detail.trainee.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-micro text-muted-foreground">
                    <span>{activeProgram?.name ?? messages.coach.noProgramsAssigned}</span>
                    <span aria-hidden="true">·</span>
                    <span>{memberSince}</span>
                    {detail.trainee.fitnessGoals.length > 0 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{detail.trainee.fitnessGoals.slice(0, 2).join(" · ")}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button asChild variant="outline" className="gap-2">
                  <Link href={`/coach/trainees/${detail.trainee.id}?tab=training`}>
                    <Dumbbell className="h-4 w-4" aria-hidden="true" />
                    {messages.coach.assignProgram}
                  </Link>
                </Button>
                <Button asChild className="hidden gap-2 sm:inline-flex xl:hidden">
                  <Link href="/coach/trainees">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    {messages.coach.allClients}
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <CoachTraineeDetailClient coachPrograms={coachPrograms} initialDetail={detail} />
        </main>

        <div className="hidden min-w-0 xl:block">
          <TraineeRosterPanel activeTraineeId={detail.trainee.id} trainees={trainees} />
        </div>
      </div>
    </div>
  )
}
