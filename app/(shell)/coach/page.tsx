import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, ArrowRight, BellRing, CalendarPlus, Dumbbell, TrendingUp, Users } from "lucide-react"

import { PendingRequestsPanel } from "@/components/coach/pending-requests-panel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachDashboard } from "@/lib/fitness/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

export const revalidate = 30

type CoachDashboardMessages = Awaited<ReturnType<typeof getServerMessages>>

type CoachStatTone = "blue" | "green" | "orange" | "violet"

const coachStatTone = {
  blue: {
    accent: "bg-primary",
    glow: "bg-primary/15",
    icon: "border-primary/25 bg-primary/12 text-primary",
    value: "text-primary",
  },
  green: {
    accent: "bg-success",
    glow: "bg-success/15",
    icon: "border-success/25 bg-success/12 text-success",
    value: "text-success",
  },
  orange: {
    accent: "bg-warning",
    glow: "bg-warning/15",
    icon: "border-warning/25 bg-warning/12 text-warning",
    value: "text-warning",
  },
  violet: {
    accent: "bg-violet-500",
    glow: "bg-violet-500/15",
    icon: "border-violet-500/25 bg-violet-500/10 text-violet-400",
    value: "text-violet-400",
  },
} satisfies Record<CoachStatTone, Record<string, string>>

function CoachStatCard({
  icon: Icon,
  progress,
  subtitle,
  title,
  tone,
  value,
}: {
  icon: LucideIcon
  progress?: number
  subtitle: string
  title: string
  tone: CoachStatTone
  value: number | string
}) {
  const palette = coachStatTone[tone]
  const safeProgress = Math.max(0, Math.min(100, progress ?? 0))

  return (
    <article className="group relative min-h-[158px] overflow-hidden rounded-[20px] border border-border/75 bg-card/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg sm:min-h-[170px] sm:p-5">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", palette.accent)} />
      <span className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity group-hover:opacity-100", palette.glow)} />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="label-micro max-w-[8.5rem] leading-snug text-muted-foreground">{title}</p>
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", palette.icon)}>
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </span>
        </div>

        <p className={cn("mt-2 font-mono text-[34px] font-bold leading-none tracking-[-0.06em] tnum sm:text-[40px]", palette.value)}>
          {value}
        </p>
        <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">{subtitle}</p>

        <div className="mt-auto flex items-center gap-1 pt-3" aria-hidden="true">
          {progress === undefined ? (
            Array.from({ length: 5 }).map((_, index) => (
              <span key={index} className={cn("h-1 flex-1 rounded-full", index < 3 ? palette.accent : "bg-border")} />
            ))
          ) : (
            <span className="h-1 w-full overflow-hidden rounded-full bg-border/80">
              <span className={cn("block h-full rounded-full transition-[width] duration-500", palette.accent)} style={{ width: `${safeProgress}%` }} />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.round(value))}%`
}

function formatDateTime(value: Date, locale: Awaited<ReturnType<typeof getServerLocale>>) {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

function formatDate(value: Date, locale: Awaited<ReturnType<typeof getServerLocale>>) {
  return value.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "short",
  })
}

function getAdjustHref(trainee: Awaited<ReturnType<typeof fetchCoachDashboard>>["trainees"][number]) {
  const firstProgramId = trainee.assignedProgramIds?.[0]

  if (firstProgramId) {
    return `/coach/programs/${firstProgramId}?adjustTrainee=${trainee.id}`
  }

  return `/coach/trainees/${trainee.id}`
}

export default async function CoachDashboardPage() {
  const [{ accessToken }, locale, messages] = await Promise.all([
    requireAppSession({ role: "coach" }),
    getServerLocale(),
    getServerMessages(),
  ])
  const dashboard = await fetchCoachDashboard(accessToken)
  const maxWorkouts = Math.max(...dashboard.activityByDay.map((point) => point.workouts), 1)
  const coachMessages: CoachDashboardMessages["coach"] = messages.coach
  const plannedSessions = dashboard.summary.totalPlannedSessions
  const weeklyOutputRate = plannedSessions > 0
    ? (dashboard.summary.workoutsThisWeek / plannedSessions) * 100
    : 0
  const attentionRate = dashboard.summary.totalTrainees > 0
    ? (dashboard.summary.atRiskTraineeCount / dashboard.summary.totalTrainees) * 100
    : 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <CoachStatCard
            title={coachMessages.totalTrainees}
            value={dashboard.summary.totalTrainees}
            subtitle={coachMessages.totalPlannedSessionsThisWeek(dashboard.summary.totalPlannedSessions)}
            icon={Users}
            tone="blue"
          />
          <CoachStatCard
            title={coachMessages.workoutsLogged}
            value={dashboard.summary.workoutsThisWeek}
            subtitle={coachMessages.acrossAllTrainees}
            icon={Dumbbell}
            progress={weeklyOutputRate}
            tone="violet"
          />
          <CoachStatCard
            title={coachMessages.averageCompletion}
            value={formatPercent(dashboard.summary.averageCompletionRate)}
            subtitle={coachMessages.basedOnAssignedWorkload}
            icon={TrendingUp}
            progress={dashboard.summary.averageCompletionRate}
            tone="green"
          />
          <CoachStatCard
            title={coachMessages.needAttention}
            value={dashboard.summary.atRiskTraineeCount}
            subtitle={coachMessages.unreadNotifications(dashboard.summary.unreadNotificationCount)}
            icon={BellRing}
            progress={attentionRate}
            tone="orange"
          />
        </section>

        <PendingRequestsPanel initialRequests={dashboard.pendingRequests} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            {/* 7-day bar chart */}
            <div className="rounded-[10px] border border-border bg-card p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="label-micro text-muted-foreground">{coachMessages.weeklyActivity}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{coachMessages.workoutLoggingTrend}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {coachMessages.weeklyActivityCopy}
                  </p>
                </div>
                <div className="rounded-[10px] border border-border bg-muted px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">
                    {coachMessages.sessionsLogged(dashboard.summary.workoutsThisWeek)}
                  </p>
                  <p className="mt-1 text-muted-foreground">{coachMessages.coachWorkspaceAggregate}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-7 gap-2" style={{ height: 110, alignItems: "end" }}>
                {dashboard.activityByDay.map((point, i) => {
                  const isToday = i === dashboard.activityByDay.length - 1
                  const h =
                    point.workouts === 0 ? 4 : Math.max(8, Math.round((point.workouts / maxWorkouts) * 90))

                  return (
                    <div key={point.label} className="flex h-full flex-col items-center gap-1.5">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={isToday ? "w-full rounded-sm bg-primary" : "w-full rounded-sm bg-foreground"}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <p className="label-micro text-muted-foreground">{point.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent logs */}
            <div className="rounded-[10px] border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-micro text-muted-foreground">{coachMessages.recentLogs}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{coachMessages.sessionsCompletedRecently}</h2>
                </div>
                <Link href="/coach/trainees">
                  <Button variant="outline" className="bg-transparent">
                    {coachMessages.viewTrainees}
                  </Button>
                </Link>
              </div>

              <div className="mt-5 space-y-2">
                {dashboard.recentWorkoutLogs.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    {coachMessages.noRecentWorkoutLogs}
                  </div>
                ) : (
                  dashboard.recentWorkoutLogs.map((log) => (
                    <Link
                      key={log.id}
                      href={`/coach/trainees/${log.trainee.id}`}
                      className="block rounded-[10px] border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/25 hover:bg-muted/40"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{log.workout.name}</p>
                            {log.commentCount > 0 ? (
                              <span className="label-micro rounded-full bg-primary-soft px-2 py-0.5 text-primary">
                                {coachMessages.feedbackCount(log.commentCount)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted-foreground tnum">
                            {log.trainee.name} · {formatDateTime(log.startedAt, locale)}
                          </p>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground tnum sm:text-right">
                          <p>{log.totalVolume?.toLocaleString() ?? 0} kg</p>
                          <p>{log.completedAt ? formatDate(log.completedAt, locale) : coachMessages.inProgress}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Quick actions */}
            <div className="rounded-[10px] border border-border bg-card p-5">
              <p className="label-micro text-muted-foreground">{coachMessages.quickActionsTitle}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{coachMessages.coachControls}</h2>

              <div className="mt-5 space-y-2">
                <Link href="/coach/programs/new" className="block">
                  <Button variant="outline" className="w-full justify-between bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <CalendarPlus className="h-4 w-4" />
                      {coachMessages.createWorkoutPlan}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/coach/exercises" className="block">
                  <Button variant="outline" className="w-full justify-between bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      {coachMessages.manageExerciseLibrary}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/coach/trainees" className="block">
                  <Button variant="outline" className="w-full justify-between bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {coachMessages.openTraineeWorkspace}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* At-risk trainees */}
            <div className="rounded-[10px] border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="label-micro text-muted-foreground">{coachMessages.needAttention}</p>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{coachMessages.needAttention}</h2>

              <div className="mt-5 space-y-3">
                {dashboard.atRiskTrainees.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    {coachMessages.noTraineesNeedAttention}
                  </div>
                ) : (
                  dashboard.atRiskTrainees.map((trainee) => (
                    <div key={trainee.id} className="rounded-[10px] border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-muted text-sm font-medium text-foreground">
                            {getInitials(trainee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{trainee.name}</p>
                          <p className="label-micro mt-1 text-muted-foreground">
                            <span className="tnum">
                              {trainee.thisWeekWorkouts}/{trainee.plannedSessionsPerWeek ?? 0}
                            </span>{" "}
                            {coachMessages.sessionsThisWeek}
                          </p>
                        </div>
                      </div>
                      <Progress
                        value={Math.max(0, Math.min(100, trainee.completionRate ?? 0))}
                        className="mt-3 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-warning"
                      />
                      <div className="mt-3 flex gap-2">
                        <Link href={`/coach/trainees/${trainee.id}`} className="flex-1">
                          <Button variant="outline" className="w-full bg-transparent">
                            {coachMessages.viewDetail}
                          </Button>
                        </Link>
                        <Link href={getAdjustHref(trainee)} className="flex-1">
                          <Button className="w-full">{coachMessages.adjustPlan}</Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* All trainees table */}
        <section className="rounded-[10px] border border-border bg-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="label-micro text-muted-foreground">{coachMessages.allTrainees}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{coachMessages.progressOverview}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {coachMessages.traineesOverviewCopy}
              </p>
            </div>
            <Link href="/coach/trainees">
              <Button variant="outline" className="bg-transparent">
                {coachMessages.openFullList}
              </Button>
            </Link>
          </div>

          <div className="mt-5 space-y-2">
            {dashboard.trainees.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                {coachMessages.noTraineesAssignedToCoach}
              </div>
            ) : (
              dashboard.trainees.map((trainee) => (
                <div
                  key={trainee.id}
                  className="grid gap-4 rounded-[10px] border border-border bg-card px-4 py-3.5 lg:grid-cols-[minmax(0,1.2fr)_200px_160px_220px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-muted text-sm font-medium text-foreground">
                        {getInitials(trainee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{trainee.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{trainee.email}</p>
                    </div>
                  </div>

                  <div>
                    <p className="label-micro text-muted-foreground">{coachMessages.thisWeek}</p>
                    <p className="mt-1 font-mono text-lg font-semibold tnum">
                      {trainee.thisWeekWorkouts}/{trainee.plannedSessionsPerWeek ?? 0}
                    </p>
                  </div>

                  <div>
                    <p className="label-micro text-muted-foreground">{coachMessages.completion}</p>
                    <p className="mt-1 font-mono text-lg font-semibold tnum">
                      {formatPercent(trainee.completionRate ?? 0)}
                    </p>
                  </div>

                  <div className="flex gap-2 lg:justify-end">
                    <Link href={`/coach/trainees/${trainee.id}`} className="flex-1 lg:flex-none">
                      <Button variant="outline" className="w-full bg-transparent">
                        {coachMessages.open}
                      </Button>
                    </Link>
                    <Link href={getAdjustHref(trainee)} className="flex-1 lg:flex-none">
                      <Button className="w-full">{coachMessages.adjustPlan}</Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
