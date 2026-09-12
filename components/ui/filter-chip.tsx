"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  count?: number
}

export function FilterChip({ active, count, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      data-slot="filter-chip"
      data-active={active ? "" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-primary/30 bg-primary-soft text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={cn(
          "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-micro tnum",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  )
}
