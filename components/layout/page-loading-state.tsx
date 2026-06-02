import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type PageLoadingStateProps = {
  className?: string
  maxWidthClassName?: string
  showMetrics?: boolean
}

export function PageLoadingState({
  className,
  maxWidthClassName = "max-w-6xl",
  showMetrics = true,
}: PageLoadingStateProps) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 md:px-6", maxWidthClassName, className)}>
      <div className="space-y-6">
        <div className="h-1 overflow-hidden rounded-full bg-primary-soft">
          <div className="page-loading-bar h-full w-28 rounded-full bg-[linear-gradient(90deg,rgba(19,73,236,0),rgba(19,73,236,0.9),rgba(96,165,250,0.95))]" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-10 w-56 rounded-2xl" />
          <Skeleton className="h-4 max-w-[26rem] w-full" />
        </div>

        {showMetrics ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <Skeleton className="h-11 w-11 rounded-2xl" />
            </div>

            <div className="mt-8 space-y-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="rounded-2xl bg-muted/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <div className="space-y-3">
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-28 w-28 rounded-full" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>

            <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
              <Skeleton className="h-8 w-28" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-12 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-border bg-card p-6 shadow-sm">
          <Skeleton className="h-8 w-40" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-[24px] bg-muted/60 p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-6 w-52 max-w-full" />
                    <Skeleton className="h-4 w-72 max-w-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function WorkoutSessionLoadingState() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-lg">
        <div className="flex h-16 items-center justify-between px-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 text-center">
            <Skeleton className="h-5 w-40 max-w-[50vw]" />
            <Skeleton className="h-4 w-20 mx-auto" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>

        <div className="px-4 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
            <div className="page-loading-bar h-full w-24 rounded-full bg-[linear-gradient(90deg,rgba(19,73,236,0),rgba(19,73,236,0.9),rgba(96,165,250,0.95))]" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-32">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-3">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>

            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }, (_, setIndex) => (
                <div key={setIndex} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl bg-muted/60 p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-16 rounded-xl" />
                  <Skeleton className="h-10 w-16 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-lg">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
