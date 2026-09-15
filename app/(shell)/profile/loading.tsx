import { Skeleton } from "@/components/ui/skeleton"

function SettingsSectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <Skeleton className="size-8 shrink-0 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-6" aria-busy="true">
      <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/90 px-4 pb-2 pt-4 md:-mx-6 md:px-6 md:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 md:h-9 md:w-56" />
            <Skeleton className="hidden h-4 w-64 max-w-full sm:block" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0 rounded-md pointer-coarse:h-11" />
        </div>

        <div className="mt-2 flex gap-1.5 overflow-hidden py-1 lg:hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start">
        <div className="hidden space-y-1 lg:block">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-lg" />
          ))}
        </div>

        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border/70 bg-surface-subtle/60 p-3 sm:p-3.5">
              <Skeleton className="h-14 w-14 shrink-0 rounded-full sm:h-16 sm:w-16" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48 max-w-full" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 rounded-md" />
              <Skeleton className="h-16 sm:col-span-2" />
            </div>
          </section>

          <SettingsSectionSkeleton rows={3} />
          <SettingsSectionSkeleton rows={4} />
          <SettingsSectionSkeleton rows={1} />
        </div>
      </div>
    </div>
  )
}
