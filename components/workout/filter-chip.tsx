"use client"

import { cn } from "@/lib/utils"

/**
 * Pill toggle matching the design system's chip spec: inverted when active,
 * hairline border otherwise. Used for the routine tag filter and the program
 * week strip.
 */
export function FilterChip({
  active,
  children,
  className,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  className?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 pointer-coarse:h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/25",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
