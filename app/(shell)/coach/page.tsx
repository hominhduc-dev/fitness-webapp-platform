import Link from "next/link"
import { Suspense } from "react"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, CalendarPlus, CheckCheck, Dumbbell, Sparkles, TrendingUp, Users, AlertTriangle } from "lucide-react"

import { PendingRequestsPanel } from "@/components/coach/pending-requests-panel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { requireAppSession, requireAppUser } from "@/lib/auth/server"
import { fetchCoachDashboard } from "@/lib/fitness/api"
import { agentMessages } from "@/lib/i18n/messages/agent"
import { coachDashboardMessages } from "@/lib/i18n/messages/coach-dashboard"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"
import { formatDateKey } from "@/lib/time-zone"
import { getServerTimeZone } from "@/lib/time-zone-server"
import { cn } from "@/lib/utils"
import { CoachDashboardLoading } from "./loading"

export const revalidate = 30

type Dashboard = Awaited<ReturnType<typeof fetchCoachDashboard>>
type Trainee = Dashboard["trainees"][number]
type Locale = Awaited<ReturnType<typeof getServerLocale>>

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2)
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.round(value))}%`
}

function getAdjustHref(trainee: Trainee) {
  const programId = trainee.assignedProgramIds?.[0]
  return programId ? `/coach/programs/${programId}?adjustTrainee=${trainee.id}` : `/coach/trainees/${trainee.id}`
}

function formatDateTime(value: Date, locale: Locale, timeZone: string | undefined) {
  return value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone,
  })
}

function CoachStatCard({ icon: Icon, title, value, subtitle, warning = false }: {
  icon: LucideIcon; title: string; value: number | string; subtitle: string; warning?: boolean
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", warning ? "text-warning-text" : "text-muted-foreground")} />
      </div>
      <p className={cn("mt-3 font-mono text-3xl font-semibold tracking-tight tnum md:text-4xl", warning ? "text-warning-text" : "text-foreground")}>{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
    </article>
  )
}

async function CoachDashboardContent() {
  const [{ accessToken }, locale, messages, timeZone] = await Promise.all([
    requireAppSession({ role: "coach" }), getServerLocale(), getServerMessages(), getServerTimeZone(),
  ])
  const dashboard = await fetchCoachDashboard(accessToken)
  const copy = coachDashboardMessages[locale]
  const coach = messages.coach
  const todayKey = formatDateKey(new Date(), timeZone)
  const maxWorkouts = Math.max(...dashboard.activityByDay.map((day) => day.workouts), 1)
  const weekStart = dashboard.activityByDay[0]?.label
  const weekEnd = dashboard.activityByDay.at(-1)?.label

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-6 pt-page md:space-y-6 md:px-6 md:pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-primary-soft p-5 md:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full border-[32px] border-primary/5" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="label-micro text-primary">{copy.eyebrow}</p>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{copy.title}</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{copy.subtitle}</p>
          </div>
          <Button asChild variant="outline" size="icon" className="size-11 shrink-0 rounded-xl border-primary/20 bg-card text-primary">
            <Link href="/chat" aria-label={agentMessages[locale].title} title={agentMessages[locale].title}>
              <Sparkles className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-primary/15 pt-4 text-xs">
          <span className="font-medium text-primary">{copy.week}</span>
          {weekStart && weekEnd ? <span className="font-mono text-muted-foreground tnum">{weekStart} — {weekEnd}</span> : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={copy.week}>
        <CoachStatCard title={coach.totalTrainees} value={dashboard.summary.totalTrainees} subtitle={coach.totalPlannedSessionsThisWeek(dashboard.summary.totalPlannedSessions)} icon={Users} />
        <CoachStatCard title={coach.workoutsLogged} value={dashboard.summary.workoutsThisWeek} subtitle={coach.acrossAllTrainees} icon={Dumbbell} />
        <CoachStatCard title={coach.averageCompletion} value={formatPercent(dashboard.summary.averageCompletionRate)} subtitle={coach.basedOnAssignedWorkload} icon={TrendingUp} />
        <CoachStatCard title={coach.needAttention} value={dashboard.summary.atRiskTraineeCount} subtitle={coach.unreadNotifications(dashboard.summary.unreadNotificationCount)} icon={AlertTriangle} warning={dashboard.summary.atRiskTraineeCount > 0} />
      </section>

      <nav className="grid grid-cols-3 gap-2" aria-label={coach.quickActionsTitle}>
        {[
          { href: "/coach/programs/new", label: coach.createProgram, icon: CalendarPlus },
          { href: "/coach/trainees", label: coach.clients, icon: Users },
          { href: "/coach/exercises", label: coach.exerciseLibraryTitle, icon: Dumbbell },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-2 py-3 text-center text-xs font-medium transition-colors hover:border-primary/30 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:text-sm">
            <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />{label}
          </Link>
        ))}
      </nav>

      <PendingRequestsPanel initialRequests={dashboard.pendingRequests} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-6">
        <section className="order-1 rounded-2xl border border-border bg-card p-5 xl:col-start-2 xl:row-start-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">{coach.needAttention}</h2>
              <span className={cn("flex size-8 items-center justify-center rounded-xl", dashboard.atRiskTrainees.length > 0 ? "bg-warning-soft text-warning-text" : "bg-success-soft text-success-text")}>
                {dashboard.atRiskTrainees.length > 0 ? <AlertTriangle className="size-4" aria-hidden="true" /> : <CheckCheck className="size-4" aria-hidden="true" />}
              </span>
            </div>
            {dashboard.atRiskTrainees.length === 0 ? (
              <div className="mt-4 rounded-xl bg-success-soft p-4">
                <p className="text-sm font-medium text-success-text">{copy.onTrack}</p>
                <p className="mt-1 text-xs leading-relaxed text-success-text">{copy.onTrackCopy}</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-border">
                {dashboard.atRiskTrainees.map((trainee) => (
                  <div key={trainee.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/coach/trainees/${trainee.id}`} className="truncate text-sm font-semibold hover:underline">{trainee.name}</Link>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tnum">{trainee.thisWeekWorkouts}/{trainee.plannedSessionsPerWeek ?? 0} {coach.workouts}</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, trainee.completionRate ?? 0))} className="mt-3 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-warning" />
                    <div className="mt-3 flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1"><Link href={`/coach/trainees/${trainee.id}`}>{coach.viewDetail}</Link></Button>
                      <Button asChild size="sm" className="flex-1"><Link href={getAdjustHref(trainee)}>{coach.adjustPlan}</Link></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        <section className="order-2 rounded-2xl border border-border bg-card p-5 md:p-6 xl:col-start-1 xl:row-start-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{copy.activity}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.activityCopy}</p>
              </div>



              <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 font-mono text-xs font-medium text-primary tnum">{dashboard.summary.workoutsThisWeek} {coach.workouts}</span>
            </div>
            <div className="mt-6 grid h-40 grid-cols-7 gap-3 sm:gap-5">
              {dashboard.activityByDay.map((point) => {
                const isToday = point.date.toISOString().slice(0, 10) === todayKey
                return (
                  <div key={point.date.toISOString()} className="flex min-w-0 flex-col items-center gap-2" role="img" aria-label={copy.chartDay(point.label, point.workouts)}>
                    <div className="flex w-full flex-1 flex-col items-center justify-end gap-2">
                      <span className={cn("font-mono text-xs tnum", isToday ? "font-semibold text-primary" : "text-muted-foreground")}>{point.workouts}</span>
                      <div className={cn("w-full max-w-12 rounded-t-lg", isToday ? "bg-primary" : point.workouts > 0 ? "bg-primary/30" : "bg-muted")} style={{ height: `${point.workouts === 0 ? 4 : Math.max(12, (point.workouts / maxWorkouts) * 96)}px` }} />
                    </div>
                    <span className={cn("font-mono text-micro tnum", isToday ? "font-semibold text-primary" : "text-muted-foreground")}>{point.label}</span>
                    <span className={cn("size-1 rounded-full", isToday ? "bg-primary" : "bg-transparent")} aria-hidden="true" />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="order-3 overflow-hidden rounded-2xl border border-border bg-card xl:col-start-1 xl:row-start-2">
            <div className="flex items-start justify-between gap-3 p-5 md:p-6">
              <div><h2 className="text-lg font-semibold tracking-tight">{copy.roster}</h2><p className="mt-1 text-xs text-muted-foreground">{copy.rosterCopy}</p></div>
              <Link href="/coach/trainees" className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary">{coach.viewAll}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            </div>
            {dashboard.trainees.length === 0 ? <p className="px-5 pb-6 text-sm text-muted-foreground">{coach.noTraineesAssignedToCoach}</p> : (
              <div className="divide-y divide-border">
                {dashboard.trainees.map((trainee) => (
                  <div key={trainee.id} className="space-y-3 px-5 py-4 md:px-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 shrink-0 border border-border">
                        <AvatarImage src={trainee.avatar || undefined} alt="" />
                        <AvatarFallback className="bg-primary-soft text-xs font-medium text-primary">{getInitials(trainee.name)}</AvatarFallback>
                      </Avatar>
                      <Link href={`/coach/trainees/${trainee.id}`} className="min-w-0 flex-1 hover:underline"><p className="truncate text-sm font-semibold">{trainee.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{trainee.email}</p></Link>
                      <span className="shrink-0 font-mono text-sm font-semibold tnum">{formatPercent(trainee.completionRate ?? 0)}</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, trainee.completionRate ?? 0))} className="h-1.5" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground"><span className="font-mono tnum">{trainee.thisWeekWorkouts}/{trainee.plannedSessionsPerWeek ?? 0}</span> {coach.sessionsThisWeek}</p>
                      <Button asChild variant="ghost" size="sm" className="text-primary"><Link href={getAdjustHref(trainee)}>{coach.adjustPlan}<ArrowRight className="size-3.5" aria-hidden="true" /></Link></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        <section className="order-4 rounded-2xl border border-border bg-card p-5 xl:col-start-2 xl:row-start-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">{copy.latest}</h2>
              <Link href="/coach/trainees" className="flex min-h-11 items-center gap-1 text-xs font-medium text-primary">{coach.viewAll}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            </div>
            <div className="mt-2 divide-y divide-border">
              {dashboard.recentWorkoutLogs.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{coach.noRecentWorkoutLogs}</p> : dashboard.recentWorkoutLogs.map((log) => (
                <Link key={log.id} href={`/coach/trainees/${log.trainee.id}`} className="flex items-start gap-3 rounded-lg py-4 transition-colors hover:bg-muted/40">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Dumbbell className="size-4" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{log.trainee.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{log.workout.name}</p>
                    <p className="mt-2 font-mono text-micro text-muted-foreground tnum">{formatDateTime(log.startedAt, locale, timeZone)}</p>
                    {log.commentCount > 0 ? <p className="mt-1 text-xs text-primary">{coach.feedbackCount(log.commentCount)}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-medium tnum">{(log.totalVolume ?? 0).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} kg</p>
                    {!log.completedAt ? <p className="mt-1 text-xs text-muted-foreground">{coach.inProgress}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
      </div>
    </div>
  )
}

export default async function CoachDashboardPage() {
  await requireAppUser({ role: "coach" })
  return <Suspense fallback={<CoachDashboardLoading />}><CoachDashboardContent /></Suspense>
}
