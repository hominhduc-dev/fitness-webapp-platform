"use client"

import { useSearchParams } from "next/navigation"

import { isNavItemActive, type ShellNavItem } from "@/components/layout/shell-nav"
import { cn } from "@/lib/utils"

type TitleSize = "compact" | "large"

/**
 * The page's title in the app shell: the active destination's name, the role
 * badge and a one-line subtitle. Pages no longer carry their own headline, so
 * this is the page's only visible `h1` — compact in the phone header, large
 * above the content on desktop.
 */
export function ShellPageTitle({
  badge,
  className,
  size = "compact",
  subtitle,
  title,
}: {
  badge?: string
  className?: string
  size?: TitleSize
  subtitle: string
  title: string
}) {
  const large = size === "large"

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <h1
          className={cn(
            "truncate font-semibold text-foreground",
            large ? "text-2xl leading-tight tracking-[-0.02em]" : "text-base leading-tight",
          )}
        >
          {title}
        </h1>
        {badge ? (
          <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-micro font-semibold uppercase tracking-[0.08em] text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <p className={cn("truncate leading-tight text-muted-foreground", large ? "mt-1 text-sm" : "mt-0.5 text-xs")}>{subtitle}</p>
    </div>
  )
}

/**
 * `ShellPageTitle` for whichever nav item matches the current route. Reads
 * `?s=` (admin sections), so it has to sit inside a Suspense boundary.
 */
export function ActiveShellPageTitle({
  items,
  pathname,
  ...props
}: {
  badge?: string
  className?: string
  /** Nav destinations, plus any page reached from elsewhere that still needs a title. */
  items: Array<Pick<ShellNavItem, "exact" | "href" | "label">>
  pathname: string
  size?: TitleSize
  subtitle: string
}) {
  const section = useSearchParams().get("s")
  const activeItem = items.find((item) => isNavItemActive(pathname, item, section))
  return <ShellPageTitle {...props} title={activeItem?.label ?? "YeahBuddy"} />
}
