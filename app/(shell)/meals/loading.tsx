import { Skeleton } from "@/components/ui/skeleton"

function MealCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-md" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-4 w-16" />
        <Skeleton className="h-[30px] w-[30px] rounded-md" />
      </div>
      <div className="border-t border-border px-4 py-3">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6" aria-busy="true">
      <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-64 md:h-10 md:w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>

      <div className="mb-5 flex items-center justify-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-4 w-28" />
          <Skeleton className="mx-auto h-3.5 w-36" />
        </div>
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>

      <section className="mb-5 rounded-lg border border-border bg-card p-[18px] md:mb-6 md:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-9">
          <div className="flex items-center justify-center gap-4 md:justify-start">
            <Skeleton className="h-32 w-32 shrink-0 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div>
          <Skeleton className="mb-3 h-3 w-16" />
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => <MealCardSkeleton key={index} />)}
          </div>
        </div>
        <section className="rounded-lg border border-border bg-card p-[18px] lg:mt-7">
          <Skeleton className="mb-4 h-3 w-32" />
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="grid grid-cols-[60px_minmax(0,1fr)_38px] items-center gap-2.5">
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-7" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
