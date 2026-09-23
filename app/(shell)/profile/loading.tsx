import { Skeleton } from "@/components/ui/skeleton"

function SettingsRowSkeleton({ expanded = false }: { expanded?: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex min-h-11 items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40 max-w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Skeleton className="size-5 shrink-0 rounded-md" />
      </div>
      {expanded ? (
        <div className="mt-4 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
      ) : null}
    </section>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-page md:px-6" aria-busy="true">
      <div className="mb-5 flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-36 md:h-9" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="space-y-3">
        <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 sm:gap-4 sm:p-5">
          <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-36 max-w-full" />
            <Skeleton className="h-4 w-52 max-w-full" />
            <Skeleton className="h-4 w-32 max-w-full" />
          </div>
          <Skeleton className="h-10 w-20 shrink-0 rounded-xl" />
        </section>
        <SettingsRowSkeleton />
        <SettingsRowSkeleton expanded />
        <SettingsRowSkeleton />
        <SettingsRowSkeleton />
        <SettingsRowSkeleton />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  )
}
