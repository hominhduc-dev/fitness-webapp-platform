import { Check, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A full-width selectable row: leading visual, title, one line of detail, and
 * a trailing chevron that turns into a check once selected.
 */
export function OptionRow({
  className,
  description,
  disabled,
  icon,
  onClick,
  selected = false,
  title,
  trailing,
}: {
  className?: string
  description?: ReactNode
  disabled?: boolean
  icon?: ReactNode
  onClick: () => void
  selected?: boolean
  title: ReactNode
  trailing?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 sm:gap-4",
        selected ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-input hover:bg-surface-hover",
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground sm:text-base">{title}</span>
        {description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground sm:text-sm">{description}</span>
        ) : null}
      </span>
      {trailing ??
        (selected ? (
          <Check aria-hidden="true" className="size-5 shrink-0 text-primary" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        ))}
    </button>
  )
}
