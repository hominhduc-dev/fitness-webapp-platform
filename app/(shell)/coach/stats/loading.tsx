import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto mt-3 h-4 w-72 max-w-full" />
      </div>
    </div>
  )
}
