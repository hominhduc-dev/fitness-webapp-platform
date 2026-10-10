import { Skeleton } from "@/components/ui/skeleton"
import { getServerLocale } from "@/lib/i18n/server"
import { coachDashboardMessages } from "@/lib/i18n/messages/coach-dashboard"

export async function CoachDashboardLoading() {
  const locale = await getServerLocale()
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-6 pt-page md:space-y-6 md:px-6 md:pb-8" role="status">
      <span className="sr-only">{coachDashboardMessages[locale].loading}</span>
      <Skeleton className="h-52 rounded-3xl" />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}
      </section>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)}
      </div>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </section>
    </div>
  )
}

export default function Loading() {
  return <CoachDashboardLoading />
}
