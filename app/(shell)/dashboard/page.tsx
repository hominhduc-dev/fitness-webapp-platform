import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"
import { DashboardOverviewClient } from "@/components/dashboard/dashboard-overview-client"
import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { Suspense } from "react"

import { requireAppSession } from "@/lib/auth/server"
import { fetchDashboard, fetchProgressAnalytics, fetchRecoveryHistory, fetchVolumeRecovery } from "@/lib/fitness/api"
import { READINESS_TREND_DEFAULT_DAYS } from "@/lib/fitness/progress-ranges"

type DashboardOverviewProps = {
  accessToken: string
  analytics?: Awaited<ReturnType<typeof fetchProgressAnalytics>>
  initialData: Awaited<ReturnType<typeof fetchDashboard>>
  preferredWeightUnit?: "kg" | "lbs"
}

export const revalidate = 30

async function DashboardOverview({ accessToken, analytics, initialData, preferredWeightUnit }: DashboardOverviewProps) {
  // Fetched together so the readiness, check-in and weekly cards render with the
  // page instead of each starting its own request after hydration. A failed seed
  // is dropped and that card's query fetches on the client.
  const [volumeRecovery, recoveryHistory] = await Promise.all([
    fetchVolumeRecovery(accessToken).catch(() => undefined),
    // The check-in streak in the greeting; the same range the readiness trend uses,
    // so the Recovery tab reuses this cache entry.
    fetchRecoveryHistory(accessToken, READINESS_TREND_DEFAULT_DAYS).catch(() => undefined),
  ])

  return (
    <DashboardOverviewClient
      initialData={initialData}
      preferredWeightUnit={preferredWeightUnit}
      seeds={{ analytics, recoveryHistory, volumeRecovery }}
    />
  )
}

export default async function DashboardPage() {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })
  const firstName = profile.name.split(" ")[0]
  const [dashboard, analytics] = await Promise.all([
    fetchDashboard(accessToken),
    fetchProgressAnalytics(accessToken).catch(() => undefined),
  ])

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-4 md:px-6 md:py-6">
      <div className="space-y-4">
        <DashboardGreeting
          avatar={profile.avatar}
          firstName={firstName}
          fullName={profile.name}
          scheduleEntries={dashboard.scheduleEntries}
          streakWeeks={analytics?.summary.currentStreakWeeks ?? 0}
        />

        <Suspense fallback={<DashboardOverviewSkeleton />}>
          <DashboardOverview
            accessToken={accessToken}
            analytics={analytics}
            initialData={dashboard}
            preferredWeightUnit={profile.preferredWeightUnit}
          />
        </Suspense>
      </div>
    </div>
  )
}
