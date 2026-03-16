import { Dumbbell, ShieldCheck } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Badge } from "@/components/ui/badge"
import { requireAppSession } from "@/lib/auth/server"
import { fetchAdminDashboard } from "@/lib/admin/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"
import type { UserRole } from "@/lib/types"

function formatDate(date: Date, locale: "en" | "vi") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function roleBadgeVariant(role: UserRole) {
  switch (role) {
    case "admin":
      return "default"
    case "coach":
      return "secondary"
    default:
      return "outline"
  }
}

export default async function AdminPage() {
  const { accessToken, profile } = await requireAppSession({ role: "admin" })
  const locale = await getServerLocale()
  const messages = await getServerMessages()
  const dashboard = await fetchAdminDashboard(accessToken)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="admin" />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {messages.admin.badge}
                </div>
                <h1 className="text-2xl font-bold md:text-3xl">
                  {messages.admin.hello}, <span className="text-primary">{profile.name}</span>
                </h1>
                <p className="mt-1 text-muted-foreground">
                  {messages.admin.subtitle}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{messages.admin.admins}</p>
                  <p className="text-xl font-semibold">{dashboard.stats.totalAdmins}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{messages.admin.programs}</p>
                  <p className="text-xl font-semibold">{dashboard.stats.totalPrograms}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{messages.admin.meals}</p>
                  <p className="text-xl font-semibold">{dashboard.stats.totalMeals}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{messages.admin.workoutLogs}</p>
                  <p className="text-xl font-semibold">{dashboard.stats.totalWorkoutLogs}</p>
                </div>
              </div>
            </div>

            <div className="mb-6 grid gap-4 grid-cols-2 xl:grid-cols-4">
              <StatsCard title={messages.admin.totalUsers} value={dashboard.stats.totalUsers} subtitle={messages.admin.allRoles} iconName="users" variant="primary" />
              <StatsCard title={messages.admin.coaches} value={dashboard.stats.totalCoaches} subtitle={messages.admin.activeCoachAccounts} iconName="shield-check" />
              <StatsCard title={messages.admin.trainees} value={dashboard.stats.totalTrainees} subtitle={messages.admin.managedFitnessUsers} iconName="users" />
              <StatsCard
                title={messages.admin.pendingRequests}
                value={dashboard.stats.pendingCoachRequests}
                subtitle={messages.admin.waitingForCoachAction}
                iconName="clipboard-list"
                variant="accent"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="xl:col-span-2 rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{messages.admin.recentUsers}</h2>
                    <p className="text-sm text-muted-foreground">{messages.admin.recentUsersCopy}</p>
                  </div>
                  <Badge variant="outline">{dashboard.recentUsers.length} users</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard.recentUsers.length === 0 ? (
                    <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">{messages.admin.noUsers}</div>
                  ) : (
                    dashboard.recentUsers.map((user) => (
                      <div key={user.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{user.name}</p>
                              <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
                            </div>
                            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <div className="text-sm text-muted-foreground">{messages.admin.joined} {formatDate(user.createdAt, locale)}</div>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                          <p>
                            Programs: <span className="font-medium text-foreground">{user.programCount}</span>
                          </p>
                          <p>
                            Trainees: <span className="font-medium text-foreground">{user.traineeCount}</span>
                          </p>
                          <p>
                            Workout logs: <span className="font-medium text-foreground">{user.workoutLogCount}</span>
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{messages.admin.pendingQueue}</h2>
                    <p className="text-sm text-muted-foreground">{messages.admin.pendingQueueCopy}</p>
                  </div>
                  <Badge>{dashboard.pendingCoachRequests.length}</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard.pendingCoachRequests.length === 0 ? (
                    <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">{messages.admin.noPending}</div>
                  ) : (
                    dashboard.pendingCoachRequests.map((requestItem) => (
                      <div key={requestItem.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Badge variant="outline">{requestItem.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(requestItem.createdAt, locale)}</span>
                        </div>
                        <p className="text-sm font-medium">{requestItem.trainee.name}</p>
                        <p className="text-xs text-muted-foreground">{requestItem.trainee.email}</p>
                        <div className="my-3 h-px bg-border" />
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{messages.admin.requestedCoach}</p>
                        <p className="text-sm font-medium">{requestItem.coach.name}</p>
                        <p className="text-xs text-muted-foreground">{requestItem.coach.email}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{messages.admin.topCoaches}</h2>
                    <p className="text-sm text-muted-foreground">{messages.admin.topCoachesCopy}</p>
                  </div>
                  <Badge variant="secondary">{dashboard.topCoaches.length}</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard.topCoaches.length === 0 ? (
                    <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">{messages.admin.noCoaches}</div>
                  ) : (
                    dashboard.topCoaches.map((coach, index) => (
                      <div key={coach.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {index + 1}
                            </span>
                            <p className="truncate font-medium">{coach.name}</p>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{coach.email}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium">{coach.traineeCount} {messages.admin.traineesLabel}</p>
                          <p className="text-muted-foreground">{coach.programCount} {messages.admin.programsLabel}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{messages.admin.recentPrograms}</h2>
                    <p className="text-sm text-muted-foreground">{messages.admin.recentProgramsCopy}</p>
                  </div>
                  <Badge variant="outline">{dashboard.recentPrograms.length}</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard.recentPrograms.length === 0 ? (
                    <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">{messages.admin.noPrograms}</div>
                  ) : (
                    dashboard.recentPrograms.map((program) => (
                      <div key={program.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-medium">{program.name}</p>
                          <Badge variant="outline">{program.difficulty}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Coach: {program.createdBy.name}</p>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                          <p>
                            {messages.admin.duration}: <span className="font-medium text-foreground">{program.duration} {messages.admin.weeks}</span>
                          </p>
                          <p>
                            {messages.admin.workouts}: <span className="font-medium text-foreground">{program.workoutsPerWeek}/week</span>
                          </p>
                          <p>
                            {messages.admin.assignments}: <span className="font-medium text-foreground">{program.assignmentCount}</span>
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Dumbbell className="h-3.5 w-3.5" />
                          {messages.admin.created} {formatDate(program.createdAt, locale)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>

        <MobileNav role="admin" />
      </div>
    </div>
  )
}
