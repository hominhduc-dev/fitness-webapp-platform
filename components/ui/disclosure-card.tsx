"use client"

import { ChevronDown } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * A card whose header toggles its body. Works uncontrolled (`defaultOpen`) or
 * controlled (`open` + `onOpenChange`) when the parent needs to open it, e.g.
 * after an action elsewhere fills in a field inside.
 */
export function DisclosureCard({
  children,
  className,
  defaultOpen = false,
  description,
  icon,
  onOpenChange,
  open: controlledOpen,
  title,
}: {
  children: ReactNode
  className?: string
  defaultOpen?: boolean
  description?: ReactNode
  icon?: ReactNode
  onOpenChange?: (open: boolean) => void
  open?: boolean
  title: ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const contentId = useId()

  const toggle = () => {
    const next = !open
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-hover sm:gap-4 sm:p-4"
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground sm:text-base">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground sm:text-sm">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div id={contentId} className="px-3 pb-3 sm:px-4 sm:pb-4">
          {children}
        </div>
      ) : null}
    </section>
  )
}
