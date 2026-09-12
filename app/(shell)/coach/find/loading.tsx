import { Skeleton } from "@/components/ui/skeleton"

function CoachCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="p-6">
        <div className="mb-4 flex items-start gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-32 max-w-full" />
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <Skeleton className="h-[62px] rounded-lg" />
          <Skeleton className="h-[62px] rounded-lg" />
        </div>

        <div className="flex gap-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      <div className="border-t border-border bg-muted/30 p-4">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-52 md:h-9 md:w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <Skeleton className="mb-6 h-10 w-full rounded-md" />

      <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-6">
        <Skeleton className="h-6 w-40" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="mb-4 h-6 w-44" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <CoachCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
