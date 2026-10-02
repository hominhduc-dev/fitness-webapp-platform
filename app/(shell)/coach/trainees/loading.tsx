import { Skeleton } from "@/components/ui/skeleton"

/**
 * Fills the detail column while a trainee loads; the roster beside it is the
 * layout's and stays on screen.
 */
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 @5xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
      </div>
      <div className="grid gap-4 @4xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-56 rounded-2xl" />)}
      </div>
    </div>
  )
}
