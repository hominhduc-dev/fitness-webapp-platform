import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarPlus, Dumbbell, Users } from "lucide-react"

import { PendingRequestsPanel } from "@/components/coach/pending-requests-panel"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachDashboard } from "@/lib/fitness/api"

export const revalidate = 30

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

function getAdjustHref(trainee: Awaited<ReturnType<typeof fetchCoachDashboard>>["trainees"][number]) {
  const firstProgramId = trainee.assignedProgramIds?.[0]

  if (firstProgramId) {
    return `/coach/programs/${firstProgramId}?adjustTrainee=${trainee.id}`
  }

  return `/coach/trainees/${trainee.id}`
}

export default async function CoachDashboardPage() {
  const [{ accessToken, profile }] = await Promise.all([requireAppSession({ role: "coach" })])
  const dashboard = await fetchCoachDashboard(accessToken)
  const maxWorkouts = Math.max(...dashboard.activityByDay.map((point) => point.workouts), 1)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-6">
        {/* Hero — flat dark band, no gradient */}
        <section className="rounded-[10px] border border-border bg-foreground px-6 py-7 text-background">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="label-micro text-background/60">Coach workspace</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Theo doi tien do tat ca trainee trong mot man hinh.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-background/70 md:text-base">
                {profile.name}, day la tong quan nhanh ve muc do tuan thu, buoi tap moi log, trainee can can thiep va
                inbox thong bao moi.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[10px] border border-background/15 bg-background/8 px-4 py-3">
                <p className="label-micro text-background/60">Trainees</p>
                <p className="mt-2 font-mono text-3xl font-semibold tnum">{dashboard.summary.totalTrainees}</p>
              </div>
              <div className="rounded-[10px] border border-background/15 bg-background/8 px-4 py-3">
                <p className="label-micro text-background/60">Compliance</p>
                <p className="mt-2 font-mono text-3xl font-semibold tnum">
                  {formatPercent(dashboard.summary.averageCompletionRate)}
                </p>
              </div>
              <div className="rounded-[10px] border border-background/15 bg-background/8 px-4 py-3">
                <p className="label-micro text-background/60">Unread inbox</p>
                <p className="mt-2 font-mono text-3xl font-semibold tnum">
                  {dashboard.summary.unreadNotificationCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Total trainees"
            value={dashboard.summary.totalTrainees}
            subtitle={`${dashboard.summary.totalPlannedSessions} planned sessions this week`}
            iconName="users"
            variant="primary"
          />
          <StatsCard
            title="Workouts logged"
            value={dashboard.summary.workoutsThisWeek}
            subtitle="Across all trainees in the last 7 days"
            iconName="dumbbell"
          />
          <StatsCard
            title="Average completion"
            value={formatPercent(dashboard.summary.averageCompletionRate)}
            subtitle="Based on assigned weekly workload"
            iconName="trending-up"
            variant="accent"
          />
          <StatsCard
            title="Need attention"
            value={dashboard.summary.atRiskTraineeCount}
            subtitle={`${dashboard.summary.unreadNotificationCount} unread notifications`}
            iconName="bell-ring"
          />
        </section>

        <PendingRequestsPanel initialRequests={dashboard.pendingRequests} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            {/* 7-day bar chart */}
            <div className="rounded-[10px] border border-border bg-card p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="label-micro text-muted-foreground">7-day activity</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Workout logging trend</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nhin nhanh muc do hoat dong va volume duoc ghi trong 7 ngay gan nhat.
                  </p>
                </div>
                <div className="rounded-[10px] border border-border bg-muted px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">
                    <span className="font-mono tnum">{dashboard.summary.workoutsThisWeek}</span> sessions logged
                  </p>
                  <p className="mt-1 text-muted-foreground">Coach workspace aggregate</p>
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
                  <p className="label-micro text-muted-foreground">Recent logs</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sessions completed recently</h2>
                </div>
                <Link href="/coach/trainees">
                  <Button variant="outline" className="bg-transparent">
                    View trainees
                  </Button>
                </Link>
              </div>

              <div className="mt-5 space-y-2">
                {dashboard.recentWorkoutLogs.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                    Chua co buoi tap nao duoc log gan day.
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
                              <span className="label-micro rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                {log.commentCount} feedback
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted-foreground tnum">
                            {log.trainee.name} · {log.startedAt.toLocaleString()}
                          </p>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground tnum sm:text-right">
                          <p>{log.totalVolume?.toLocaleString() ?? 0} kg</p>
                          <p>{log.completedAt ? log.completedAt.toLocaleDateString() : "In progress"}</p>
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
              <p className="label-micro text-muted-foreground">Quick actions</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Coach controls</h2>

              <div className="mt-5 space-y-2">
                <Link href="/coach/programs/new" className="block">
                  <Button variant="outline" className="w-full justify-between bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <CalendarPlus className="h-4 w-4" />
                      Create workout plan
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/coach/exercises" className="block">
                  <Button variant="outline" className="w-full justify-between bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      Manage exercise library
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/coach/trainees" className="block">
                  <Button variant="outline" className="w-full justify-between bg-transparent">
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Open trainee workspace
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
                <p className="label-micro text-muted-foreground">At-risk trainees</p>
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Who needs attention now</h2>

              <div className="mt-5 space-y-3">
                {dashboard.atRiskTrainees.length === 0 ? (
                  <div className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Tat ca trainee dang giu nhip on dinh trong tuan nay.
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
                            sessions this week
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
                            View detail
                          </Button>
                        </Link>
                        <Link href={getAdjustHref(trainee)} className="flex-1">
                          <Button className="w-full">Adjust plan</Button>
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
              <p className="label-micro text-muted-foreground">All trainees</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Progress overview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dung bang nay de quet nhanh completion rate, workload va vao dieu chinh plan khi can.
              </p>
            </div>
            <Link href="/coach/trainees">
              <Button variant="outline" className="bg-transparent">
                Open full list
              </Button>
            </Link>
          </div>

          <div className="mt-5 space-y-2">
            {dashboard.trainees.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                Chua co trainee nao duoc assign cho coach nay.
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
                    <p className="label-micro text-muted-foreground">This week</p>
                    <p className="mt-1 font-mono text-lg font-semibold tnum">
                      {trainee.thisWeekWorkouts}/{trainee.plannedSessionsPerWeek ?? 0}
                    </p>
                  </div>

                  <div>
                    <p className="label-micro text-muted-foreground">Completion</p>
                    <p className="mt-1 font-mono text-lg font-semibold tnum">
                      {formatPercent(trainee.completionRate ?? 0)}
                    </p>
                  </div>

                  <div className="flex gap-2 lg:justify-end">
                    <Link href={`/coach/trainees/${trainee.id}`} className="flex-1 lg:flex-none">
                      <Button variant="outline" className="w-full bg-transparent">
                        Open
                      </Button>
                    </Link>
                    <Link href={getAdjustHref(trainee)} className="flex-1 lg:flex-none">
                      <Button className="w-full">Adjust plan</Button>
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
