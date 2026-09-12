import { Skeleton } from "@/components/ui/skeleton"

function ProgramCardSkeleton() {
  return (
    <div className="flex min-h-[276px] flex-col gap-3.5 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-44 max-w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <Skeleton className="min-h-12 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-20 rounded-md" />
      </div>
      <Skeleton className="h-3 w-28" />
    </div>
  )
}

export default function Loading() {
  return (
    <div className="px-4 py-6 md:px-9 md:py-10">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-48 sm:h-10 sm:w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Skeleton className="h-10 w-full rounded-md sm:w-32" />
          <Skeleton className="h-10 w-full rounded-md sm:w-36" />
          <Skeleton className="h-10 w-full rounded-md sm:w-32" />
        </div>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {Array.from({ length: 6 }, (_, index) => <ProgramCardSkeleton key={index} />)}
      </div>
    </div>
  )
}
