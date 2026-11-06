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

function CoachStatCard({ icon: Icon, title, value, subtitle, href, warning = false }: {
  icon: LucideIcon; title: string; value: number | string; subtitle?: string; href?: string; warning?: boolean
}) {
  const className = "min-w-0 rounded-2xl border border-border bg-card p-3.5 md:p-4"
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Icon aria-hidden="true" className={cn("size-4", warning ? "text-warning-text" : "text-muted-foreground")} />
          {href && <ArrowRight aria-hidden="true" className="size-3.5 text-muted-foreground" />}
        </div>
      </div>
      <p className={cn("mt-2 font-mono text-2xl font-semibold tracking-tight tnum md:text-3xl", warning ? "text-warning-text" : "text-foreground")}>{value}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
    </>
  )

  return href ? (
    <a href={href} className={cn(className, "block transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {content}
    </a>
  ) : <article className={className}>{content}</article>
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
      <section aria-labelledby="coach-week-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="coach-week-title" className="text-xl font-semibold tracking-tight">{copy.week}</h2>
            {weekStart && weekEnd ? <p className="mt-0.5 font-mono text-xs text-muted-foreground tnum">{weekStart} – {weekEnd}</p> : null}
          </div>
          <Button asChild variant="outline" size="icon" className="size-11 shrink-0 rounded-xl border-primary/20 bg-card text-primary">
            <Link href="/chat" aria-label={agentMessages[locale].title} title={agentMessages[locale].title}>
              <Sparkles className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CoachStatCard title={coach.totalTrainees} value={dashboard.summary.totalTrainees} subtitle={copy.plannedSessions(dashboard.summary.totalPlannedSessions)} icon={Users} />
          <CoachStatCard title={coach.workoutsLogged} value={dashboard.summary.workoutsThisWeek} icon={Dumbbell} />
          <CoachStatCard title={coach.averageCompletion} value={formatPercent(dashboard.summary.averageCompletionRate)} subtitle={copy.assignedWorkload} icon={TrendingUp} />
          <CoachStatCard title={coach.needAttention} value={dashboard.summary.atRiskTraineeCount} subtitle={coach.unreadNotifications(dashboard.summary.unreadNotificationCount)} icon={AlertTriangle} href="#coach-attention" warning={dashboard.summary.atRiskTraineeCount > 0} />
        </div>
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
        <section id="coach-attention" tabIndex={-1} aria-labelledby="coach-attention-title" className="order-1 scroll-mt-20 rounded-2xl border border-border bg-card p-5 focus-visible:outline-ring xl:col-start-2 xl:row-start-1">
            <div className="flex items-center justify-between gap-3">
              <h2 id="coach-attention-title" className="text-lg font-semibold tracking-tight">{coach.needAttention}</h2>
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
                      <Link href={`/coach/trainees/${trainee.id}`} className="flex min-h-11 min-w-0 items-center text-sm font-semibold hover:underline">
                        <span className="truncate">{trainee.name}</span>
                      </Link>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tnum">{trainee.thisWeekWorkouts}/{trainee.plannedSessionsPerWeek ?? 0} {coach.workouts}</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, trainee.completionRate ?? 0))} className="mt-3 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-warning" />
                    <div className="mt-3 flex justify-end">
                      <Button asChild size="sm" className="min-h-11"><Link href={getAdjustHref(trainee)}>{coach.adjustPlan}</Link></Button>
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
              <Link href="/coach/trainees" className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary">{copy.chooseClient}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
            </div>
            <div className="mt-2 divide-y divide-border">
              {dashboard.recentWorkoutLogs.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{coach.noRecentWorkoutLogs}</p> : dashboard.recentWorkoutLogs.map((log) => (
                <Link key={log.id} href={`/coach/trainees/${log.trainee.id}`} className="flex min-h-11 items-start gap-3 rounded-lg py-3 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{log.trainee.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{log.workout.name}</p>
                    {log.commentCount > 0 ? <p className="mt-1 text-xs text-primary">{coach.feedbackCount(log.commentCount)}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-medium tnum">{(log.totalVolume ?? 0).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} kg</p>
                    <time dateTime={log.startedAt.toISOString()} className="mt-0.5 block font-mono text-micro text-muted-foreground tnum">{formatDateTime(log.startedAt, locale, timeZone)}</time>
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
