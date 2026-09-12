import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 py-6 md:px-6" aria-busy="true">
      <div className="mb-5 flex flex-col items-start justify-between gap-3.5 sm:mb-7 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg sm:w-36" />
      </div>
      <div className="mb-5 flex gap-2 overflow-hidden sm:mb-6">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-8 w-20 shrink-0 rounded-full" />)}
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[286px] rounded-lg" />)}
      </div>
    </main>
  )
}
