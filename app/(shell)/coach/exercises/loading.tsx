import { Skeleton } from "@/components/ui/skeleton"

function ExerciseGroupSkeleton({ open = false }: { open?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex h-[52px] items-center gap-2.5 px-4 py-3">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
      {open ? (
        <div className="border-t border-border">
          <Skeleton className="h-8 w-full rounded-none" />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid h-[54px] grid-cols-[24px_minmax(0,1fr)_56px] items-center gap-2 border-b border-border/50 px-4 last:border-0 sm:grid-cols-[24px_minmax(0,1.4fr)_minmax(0,1fr)_80px_64px_56px]">
              <Skeleton className="mx-auto h-4 w-4 rounded" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40 max-w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="ml-auto h-3 w-8" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-64 md:h-9 md:w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-36 rounded-md" />
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_150px_140px]">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        <div className="flex flex-col gap-2.5">
          <ExerciseGroupSkeleton open />
          {Array.from({ length: 5 }, (_, index) => <ExerciseGroupSkeleton key={index} />)}
        </div>
      </div>
    </div>
  )
}
