import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6" aria-busy="true">
      <div className="mb-7 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-16 w-48" />
      </div>
      <Skeleton className="mb-6 h-[280px] rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)}
      </div>
    </div>
  )
}
