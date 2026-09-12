import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8" aria-busy="true">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-3xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-lg" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
        <div>
          <Skeleton className="mb-4 h-3 w-28" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-[60px] rounded-lg" />)}
          </div>
        </div>
      </div>
    </div>
  )
}
