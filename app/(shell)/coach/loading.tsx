import { Skeleton } from "@/components/ui/skeleton"

export function CoachDashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8" role="status">
      <span className="sr-only">Loading coach dashboard...</span>
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="min-h-[158px] rounded-3xl sm:min-h-[170px]" />
          ))}
        </section>
        <Skeleton className="h-20 rounded-lg" />
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </section>
      </div>
    </div>
  )
}

export default function Loading() {
  return <CoachDashboardLoading />
}
