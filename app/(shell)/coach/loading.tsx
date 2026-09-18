import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonCard } from "@/components/layout/trainee-loading-shell"

export function CoachDashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8" role="status">
      <span className="sr-only">Loading coach dashboard...</span>
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} className="min-h-[158px] sm:min-h-[170px]" />
          ))}
        </section>
        <Skeleton className="h-20 rounded-2xl" />
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <SkeletonCard className="h-64" />
            <SkeletonCard className="h-80" />
          </div>
          <div className="space-y-6">
            <SkeletonCard className="h-64" />
            <SkeletonCard className="h-80" />
          </div>
        </section>
      </div>
    </div>
  )
}

export default function Loading() {
  return <CoachDashboardLoading />
}
