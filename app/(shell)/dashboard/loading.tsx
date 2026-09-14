import { DashboardOverviewSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-8" aria-busy="true">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="size-14 rounded-full md:hidden" />
      </div>
      <DashboardOverviewSkeleton />
    </div>
  )
}
