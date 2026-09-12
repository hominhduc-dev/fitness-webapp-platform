import { Skeleton } from "@/components/ui/skeleton"

function TraineeRowSkeleton() {
  return (
    <div className="flex h-[68px] items-center gap-3 border-b border-border border-l-[3px] border-l-transparent px-6">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-36 max-w-full" />
        <Skeleton className="h-3 w-52 max-w-full" />
      </div>
      <Skeleton className="h-3.5 w-3.5 rounded" />
    </div>
  )
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="border-b border-border px-6 pb-3 pt-5">
        <div className="mb-3.5 flex items-baseline justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="mb-3 h-10 w-full rounded-md" />
        <div className="flex gap-1.5 overflow-hidden pb-0.5">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-8 w-20 shrink-0 rounded-full" />)}
        </div>
      </div>

      <div>
        {Array.from({ length: 8 }, (_, index) => <TraineeRowSkeleton key={index} />)}
      </div>
    </div>
  )
}
