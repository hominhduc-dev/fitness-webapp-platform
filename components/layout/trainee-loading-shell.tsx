import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type React from "react"

export function TraineeMobileHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-2 flex min-h-[3.75rem] items-start justify-between gap-2 bg-background px-3 pb-2 pt-[calc(0.45rem+env(safe-area-inset-top))] md:hidden",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <div className="min-w-0 space-y-1.5 pt-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="size-10 shrink-0 rounded-full" />
    </div>
  )
}

export function TraineePageSkeleton({
  children,
  className,
  maxWidthClassName = "max-w-5xl",
  showHeader = true,
}: {
  children: React.ReactNode
  className?: string
  maxWidthClassName?: string
  showHeader?: boolean
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-2 md:px-6 md:py-6", maxWidthClassName, className)} aria-busy="true">
      {showHeader ? <TraineeMobileHeaderSkeleton /> : null}
      {children}
    </div>
  )
}

export function SkeletonCard({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5", className)}>
      {children}
    </div>
  )
}

export function SkeletonPillRow({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-hidden", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-8 w-20 shrink-0 rounded-full" />
      ))}
    </div>
  )
}
