import { Skeleton } from "@/components/ui/skeleton"

function ProfileCardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6" aria-busy="true">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-9 w-44 md:h-10 md:w-56" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="mb-5 flex items-center gap-4 rounded-xl border border-border/70 bg-muted/30 p-3.5">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full sm:h-20 sm:w-20" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <Skeleton className="h-[70px] rounded-md" />
              <Skeleton className="h-[70px] rounded-md" />
              <Skeleton className="col-span-2 h-[70px] rounded-md" />
            </div>
          </section>
          <ProfileCardSkeleton rows={6} />
        </div>

        <div className="min-w-0 space-y-4">
          <ProfileCardSkeleton rows={1} />
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-7 w-20 rounded-full" />)}
            </div>
          </section>
          <ProfileCardSkeleton rows={1} />
          <ProfileCardSkeleton rows={1} />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
