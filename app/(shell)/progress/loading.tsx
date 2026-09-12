import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6" aria-busy="true">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-[26rem] rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}
