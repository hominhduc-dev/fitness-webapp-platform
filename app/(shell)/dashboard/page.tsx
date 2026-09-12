import { DashboardOverviewClient } from "@/components/dashboard/dashboard-overview-client"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchDashboard } from "@/lib/fitness/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

type DashboardLocale = Awaited<ReturnType<typeof getServerLocale>>
type DashboardMessages = Awaited<ReturnType<typeof getServerMessages>>

type DashboardOverviewProps = {
  accessToken: string
  locale: DashboardLocale
  messages: DashboardMessages
  preferredWeightUnit?: "kg" | "lbs"
}


export const revalidate = 30

async function DashboardOverview({ accessToken, preferredWeightUnit }: DashboardOverviewProps) {
  const dashboard = await fetchDashboard(accessToken)
  return <DashboardOverviewClient initialData={dashboard} preferredWeightUnit={preferredWeightUnit} />
}

function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-w-0 rounded-3xl border border-border bg-card p-4 md:p-5">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-2.5 w-28 rounded" />
          <div className="mt-6 flex min-h-[220px] flex-col items-center justify-center gap-4">
            <Skeleton className="h-14 w-14 rounded-lg" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <Skeleton className="h-2.5 w-32 rounded" />
          <div className="mt-6 flex items-center gap-6">
            <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
            <div className="space-y-3">
              <div><Skeleton className="h-2.5 w-16 rounded" /><Skeleton className="mt-1.5 h-7 w-24" /></div>
              <div><Skeleton className="h-2.5 w-16 rounded" /><Skeleton className="mt-1.5 h-6 w-20" /></div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9 rounded-lg" />
            ))}
          </div>
        </div>
      </section>

      <section>
        <Skeleton className="mb-4 h-2.5 w-28 rounded" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[60px] rounded-lg" />
          ))}
        </div>
      </section>
    </div>
  )
}

export default async function DashboardPage() {
  const sessionPromise = requireAppSession({ role: "trainee" })
  const localePromise = getServerLocale()
  const messagesPromise = getServerMessages()

  const [{ accessToken, profile }, locale, messages] = await Promise.all([sessionPromise, localePromise, messagesPromise])

  const firstName = profile.name.split(" ")[0]
  const dashboardSubtitle =
    locale === "vi"
      ? "Theo dõi workout, dinh dưỡng và tiến độ ngay hôm nay trong một màn hình."
      : "Track today's training, nutrition, and progress from one dashboard."

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-6">
        <section>
          <span className="label-micro mb-2 block">Dashboard</span>
          <h1 className="text-4xl font-semibold leading-none tracking-[-0.02em] text-foreground">
            {messages.dashboard.welcomeBack},{" "}
            <span className="text-primary">{firstName}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{dashboardSubtitle}</p>
        </section>

        <Suspense fallback={<DashboardOverviewSkeleton />}>
          <DashboardOverview
            accessToken={accessToken}
            locale={locale}
            messages={messages}
            preferredWeightUnit={profile.preferredWeightUnit}
          />
        </Suspense>
      </div>
    </div>
  )
}
