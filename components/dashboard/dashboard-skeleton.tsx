import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the phone order of the dashboard sections to avoid layout shift. */
export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-14 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[4.75rem] rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-56 rounded-2xl lg:order-3 lg:col-span-4 lg:h-auto" />
        <div className="lg:order-1 lg:col-span-12">
          <Skeleton className="mb-2 h-5 w-32" />
          <div className="grid grid-cols-5 gap-2 md:gap-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-[4.75rem] rounded-2xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-72 rounded-2xl lg:order-2 lg:col-span-4" />
        <Skeleton className="h-72 rounded-2xl lg:order-4 lg:col-span-4" />
      </div>
    </div>
  )
}
