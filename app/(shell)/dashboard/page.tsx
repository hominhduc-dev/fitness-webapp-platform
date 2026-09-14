import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting"
import { DashboardOverviewClient } from "@/components/dashboard/dashboard-overview-client"
import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { Suspense } from "react"

import { requireAppSession } from "@/lib/auth/server"
import { fetchDashboard } from "@/lib/fitness/api"

type DashboardOverviewProps = {
  accessToken: string
  preferredWeightUnit?: "kg" | "lbs"
}

export const revalidate = 30

async function DashboardOverview({ accessToken, preferredWeightUnit }: DashboardOverviewProps) {
  const dashboard = await fetchDashboard(accessToken)
  return <DashboardOverviewClient initialData={dashboard} preferredWeightUnit={preferredWeightUnit} />
}

export default async function DashboardPage() {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })
  const firstName = profile.name.split(" ")[0]

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-4 md:px-6 md:py-6">
      <div className="space-y-4">
        <DashboardGreeting firstName={firstName} />

        <Suspense fallback={<DashboardOverviewSkeleton />}>
          <DashboardOverview accessToken={accessToken} preferredWeightUnit={profile.preferredWeightUnit} />
        </Suspense>
      </div>
    </div>
  )
}
