import { SkeletonCard } from "@/components/layout/trainee-loading-shell"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-page md:px-6">
      <SkeletonCard className="p-8 text-center">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto mt-3 h-4 w-72 max-w-full" />
      </SkeletonCard>
    </div>
  )
}
