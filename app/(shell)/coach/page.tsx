import Link from "next/link"
import { Calendar, ChevronRight, Dumbbell, Users } from "lucide-react"
import { Suspense, cache } from "react"

import { PendingRequestsPanel } from "@/components/coach/pending-requests-panel"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachDashboard } from "@/lib/fitness/api"
import { getServerMessages } from "@/lib/i18n/server"
import type { CoachDashboardData } from "@/lib/fitness/types"

type CoachMessages = Awaited<ReturnType<typeof getServerMessages>>

const getCoachDashboardData = cache(async (accessToken: string) => fetchCoachDashboard(accessToken))

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

function getCoachMetrics(dashboard: CoachDashboardData) {
  const workoutsThisWeek = dashboard.trainees.reduce((sum, trainee) => sum + trainee.thisWeekWorkouts, 0)
  const compliance =
    dashboard.trainees.length > 0 ? Math.round((workoutsThisWeek / Math.max(dashboard.trainees.length * 4, 1)) * 100) : 0
  const activeTrainees = dashboard.trainees.filter((trainee) => trainee.thisWeekWorkouts > 0)

  return {
    activeTrainees,
    compliance,
    workoutsThisWeek,
  }
}

function CoachQuickActionsCard({ messages }: { messages: CoachMessages }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
      <h3 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">{messages.coach.quickActions}</h3>
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
        <Link href="/coach/exercises">
          <Button variant="outline" className="w-full justify-start gap-2 bg-transparent text-sm">
            <Dumbbell className="h-4 w-4" />
            Exercise Library
          </Button>
        </Link>
      </div>
    </div>
  )
}

async function CoachDashboardStats({
  accessToken,
  messages,
}: {
  accessToken: string
  messages: CoachMessages
}) {
  const dashboard = await getCoachDashboardData(accessToken)
  const { compliance, workoutsThisWeek } = getCoachMetrics(dashboard)

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-4">
      <StatsCard title={messages.coach.activeTrainees} value={dashboard.trainees.length} iconName="users" variant="primary" />
      <StatsCard
        title={messages.coach.pendingRequests}
        value={dashboard.pendingRequests.length}
        iconName="user-plus"
        variant="accent"
      />
      <StatsCard
        title={messages.coach.workoutsThisWeek}
        value={workoutsThisWeek}
        subtitle={messages.coach.acrossAllTrainees}
        iconName="calendar"
      />
      <StatsCard title={messages.coach.compliance} value={`${compliance}%`} iconName="trending-up" />
    </div>
  )
}

async function CoachDashboardMainContent({
  accessToken,
  messages,
}: {
  accessToken: string
  messages: CoachMessages
}) {
  const dashboard = await getCoachDashboardData(accessToken)

  return (
    <>
      <PendingRequestsPanel initialRequests={dashboard.pendingRequests} />

      <div className="rounded-xl border border-border bg-card p-3 sm:p-6 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between sm:mb-4">
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
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <Avatar className="h-10 w-10 shrink-0 border-2 border-primary/20 sm:h-12 sm:w-12">
                    <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/10 text-xs text-primary sm:text-sm">
                      {getInitials(trainee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold sm:text-base">{trainee.name}</p>
                    <p className="hidden truncate text-xs text-muted-foreground xs:block sm:text-sm">
                      {trainee.fitnessGoals.join(", ") || messages.coach.noGoals}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">
                    {trainee.thisWeekWorkouts} {messages.coach.workouts}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trainee.programCount} {messages.coach.programs}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )
}

async function CoachRecentActivityCard({
  accessToken,
  messages,
}: {
  accessToken: string
  messages: CoachMessages
}) {
  const dashboard = await getCoachDashboardData(accessToken)
  const { activeTrainees } = getCoachMetrics(dashboard)

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
      <h3 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">{messages.coach.recentActivity}</h3>
      <div className="space-y-3 sm:space-y-4">
        {activeTrainees.length === 0 ? (
          <p className="text-sm text-muted-foreground">{messages.coach.noActivity}</p>
        ) : (
          activeTrainees.slice(0, 3).map((trainee) => (
            <div key={trainee.id} className="flex items-start gap-2 sm:gap-3">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary sm:mt-2" />
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
  )
}

function CoachStatsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="rounded-[24px] border border-border bg-card p-4 sm:p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

function CoachDashboardMainContentSkeleton() {
  return (
    <>
      <div className="lg:col-span-3 rounded-xl border border-accent/20 bg-card p-3 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-6 lg:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center justify-between rounded-lg bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function CoachRecentActivitySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
      <Skeleton className="h-6 w-32" />
      <div className="mt-4 space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-start gap-3">
            <Skeleton className="mt-2 h-2 w-2 rounded-full" />
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function CoachDashboardPage() {
  const sessionPromise = requireAppSession({ role: "coach" })
  const messagesPromise = getServerMessages()

  const [{ accessToken, profile }, messages] = await Promise.all([sessionPromise, messagesPromise])

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">
          {messages.coach.welcome}, <span className="text-primary">{profile.name}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{messages.coach.subtitle}</p>
      </div>

      <Suspense fallback={<CoachStatsSkeleton />}>
        <CoachDashboardStats accessToken={accessToken} messages={messages} />
      </Suspense>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Suspense fallback={<CoachDashboardMainContentSkeleton />}>
          <CoachDashboardMainContent accessToken={accessToken} messages={messages} />
        </Suspense>

        <div className="space-y-4 sm:space-y-6">
          <CoachQuickActionsCard messages={messages} />

          <Suspense fallback={<CoachRecentActivitySkeleton />}>
            <CoachRecentActivityCard accessToken={accessToken} messages={messages} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
