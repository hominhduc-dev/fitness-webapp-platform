import { BrandLogo } from "@/components/ui/brand-logo"
import { APP_VERSION } from "@/lib/app-version"
import { cn } from "@/lib/utils"

type AppSplashProps = {
  className?: string
  /**
   * Full viewport on a cold start, where nothing is painted yet. Inside the
   * shell the header and navigation are already on screen, so the splash fills
   * only the content area rather than covering chrome the user can see.
   */
  fullScreen?: boolean
  /**
   * Announced to screen readers. No locale provider exists above a loading
   * boundary, so the caller resolves the copy server-side and passes it in.
   */
  label: string
}

/**
 * The screen the app opens on.
 *
 * It replaces the old progress bar: a bar invites you to watch it, and the wait
 * it measures is usually shorter than the glance it costs. A still wordmark
 * reads as the app starting rather than as something being slow.
 *
 * Colours come from the theme rather than a fixed dark canvas, because this
 * screen hands straight over to the app with no transition — a black splash in
 * front of a light theme would flash on every launch.
 */
export function AppSplash({ className, fullScreen = true, label }: AppSplashProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex w-full flex-col items-center justify-center bg-background px-6 text-foreground",
        fullScreen ? "min-h-[100dvh]" : "min-h-[calc(100dvh-4rem)]",
        className,
      )}
    >
      {/* Sized to sit near 60% of a phone's width — big enough to read as a
          launch screen, short enough that "YeahBuddy" never truncates on the
          narrowest handsets. */}
      <BrandLogo
        className="max-w-full gap-3 sm:gap-4"
        markClassName="size-9 rounded-none sm:size-11"
        textClassName="text-3xl font-bold tracking-tight sm:text-4xl"
      />
      <span className="sr-only">{label}</span>

      {APP_VERSION ? (
        <p className="absolute inset-x-0 bottom-[calc(2.5rem+env(safe-area-inset-bottom))] text-center font-mono text-xs tnum text-muted-foreground">
          {APP_VERSION}
        </p>
      ) : null}
    </div>
  )
}
