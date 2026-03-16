import Link from "next/link"
import { Calendar, ChevronRight, Users } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { StatsCard } from "@/components/dashboard/stats-card"
import { PendingRequestsPanel } from "@/components/coach/pending-requests-panel"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachDashboard } from "@/lib/fitness/api"
import { getServerMessages } from "@/lib/i18n/server"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

export default async function CoachDashboardPage() {
  const { accessToken, profile } = await requireAppSession({ role: "coach" })
  const messages = await getServerMessages()
  const dashboard = await fetchCoachDashboard(accessToken)
  const workoutsThisWeek = dashboard.trainees.reduce((sum, trainee) => sum + trainee.thisWeekWorkouts, 0)
  const compliance =
    dashboard.trainees.length > 0 ? Math.round((workoutsThisWeek / Math.max(dashboard.trainees.length * 4, 1)) * 100) : 0
  const activeTrainees = dashboard.trainees.filter((trainee) => trainee.thisWeekWorkouts > 0)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">
                {messages.coach.welcome}, <span className="text-primary">{profile.name}</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {messages.coach.subtitle}
              </p>
            </div>

            <div className="mb-4 sm:mb-6 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <StatsCard title={messages.coach.activeTrainees} value={dashboard.trainees.length} iconName="users" variant="primary" />
              <StatsCard
                title={messages.coach.pendingRequests}
                value={dashboard.pendingRequests.length}
                iconName="user-plus"
                variant="accent"
              />
              <StatsCard title={messages.coach.workoutsThisWeek} value={workoutsThisWeek} subtitle={messages.coach.acrossAllTrainees} iconName="calendar" />
              <StatsCard title={messages.coach.compliance} value={`${compliance}%`} iconName="trending-up" />
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              <PendingRequestsPanel initialRequests={dashboard.pendingRequests} />

              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-3 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base font-semibold sm:text-lg">{messages.coach.yourTrainees}</h3>
                  <Link href="/coach/trainees">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs sm:text-sm">
                      {messages.coach.viewAll}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {dashboard.trainees.length === 0 ? (
                    <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">{messages.coach.noTrainees}</div>
                  ) : (
                    dashboard.trainees.map((trainee) => (
                      <Link
                        key={trainee.id}
                        href={`/coach/trainees/${trainee.id}`}
                        className="flex items-center justify-between rounded-lg bg-muted/30 p-3 sm:p-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 border-2 border-primary/20">
                            <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                              {getInitials(trainee.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate sm:text-base">{trainee.name}</p>
                            <p className="text-xs text-muted-foreground truncate hidden xs:block sm:text-sm">
                              {trainee.fitnessGoals.join(", ") || messages.coach.noGoals}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">{trainee.thisWeekWorkouts} {messages.coach.workouts}</p>
                          <p className="text-xs text-muted-foreground">{trainee.programCount} {messages.coach.programs}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
                  <h3 className="mb-3 sm:mb-4 text-base font-semibold sm:text-lg">{messages.coach.quickActions}</h3>
                  <div className="space-y-2">
                    <Link href="/coach/programs/new">
                      <Button variant="outline" className="w-full justify-start gap-2 bg-transparent text-sm">
                        <Calendar className="h-4 w-4" />
                        {messages.coach.createProgram}
                      </Button>
                    </Link>
                    <Link href="/coach/trainees">
                      <Button variant="outline" className="w-full justify-start gap-2 bg-transparent text-sm">
                        <Users className="h-4 w-4" />
                        {messages.coach.viewAllTrainees}
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
                  <h3 className="mb-3 sm:mb-4 text-base font-semibold sm:text-lg">{messages.coach.recentActivity}</h3>
                  <div className="space-y-3 sm:space-y-4">
                    {activeTrainees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{messages.coach.noActivity}</p>
                    ) : (
                      activeTrainees.slice(0, 3).map((trainee) => (
                        <div key={trainee.id} className="flex items-start gap-2 sm:gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 sm:mt-2 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm">
                              <span className="font-medium">{trainee.name}</span>{" "}
                              <span className="text-muted-foreground">
                                {messages.coach.completedWorkouts(trainee.thisWeekWorkouts)}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">{messages.coach.totalLogs(trainee.totalWorkoutLogs)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <MobileNav role="coach" />
      </div>
    </div>
  )
}
