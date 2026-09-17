"use client"

import { ChevronDown, type LucideIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { IconTile } from "@/components/ui/icon-tile"
import { cn } from "@/lib/utils"

/**
 * One card on the settings page. The `id` doubles as a scroll anchor, so the
 * scroll margin here has to clear the sticky page header.
 * `collapsible` turns a settings group into the compact disclosure row used by
 * the mobile-first settings layout. Expanded content stays inside the same card.
 */
export function SettingsSection({
  children,
  className,
  collapsible = false,
  defaultOpen = false,
  description,
  icon: Icon,
  headerVisual,
  id,
  title,
  tone = "primary",
  toggleLabel,
  trailing,
}: {
  children: ReactNode
  className?: string
  collapsible?: boolean
  defaultOpen?: boolean
  description?: ReactNode
  icon?: LucideIcon
  headerVisual?: ReactNode
  id: string
  title: ReactNode
  tone?: "danger" | "primary"
  toggleLabel?: ReactNode
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const isDanger = tone === "danger"
  const isOpen = !collapsible || open

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "scroll-mt-28 overflow-hidden rounded-xl border px-3.5 py-2.5 sm:px-4 sm:py-3",
        isDanger ? "border-destructive/30 bg-destructive-soft/70" : "border-border bg-card",
        className,
      )}
    >
      <div className={cn("flex min-h-10 items-center gap-3", isOpen && children != null && "mb-3")}>
        {headerVisual ?? (Icon ? (
          <IconTile size="sm" tone={isDanger ? "surface" : "primary"} className={cn(isDanger && "text-destructive-text")}>
            <Icon strokeWidth={1.8} />
          </IconTile>
        ) : null)}

        <div className="min-w-0 flex-1">
          {/* The description sits outside the heading (and outside the toggle)
              so neither picks up the whole paragraph as its accessible name. */}
          <h2
            id={`${id}-heading`}
            className={cn("text-base font-semibold leading-6 sm:text-lg", isDanger && "text-destructive-text")}
          >
            {collapsible ? (
              <button
                type="button"
                aria-controls={bodyId}
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="flex min-h-9 w-full items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1">{title}</span>
                {toggleLabel ? <span className="text-sm font-medium text-muted-foreground">{toggleLabel}</span> : null}
                <ChevronDown
                  aria-hidden="true"
                  className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                />
              </button>
            ) : (
              title
            )}
          </h2>

          {description ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5">{description}</p>
          ) : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>

      {isOpen && children != null ? (
        <div id={collapsible ? bodyId : undefined} className={cn(collapsible && "border-t border-border/70 pt-3")}>
          {children}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Two columns from `sm` up, one on phones — a forced two-column grid truncates
 * select values such as "Active (6–7 days/week)" at 390px.
 */
export function SettingsFieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>
}

/** Label + control + hint, so every field on the page lines up the same way. */
export function SettingsField({
  children,
  className,
  hint,
  htmlFor,
  label,
  wide = false,
}: {
  children: ReactNode
  className?: string
  hint?: ReactNode
  htmlFor?: string
  label: ReactNode
  wide?: boolean
}) {
  return (
    <div className={cn("space-y-1.5 rounded-xl border border-border/70 bg-surface-subtle/35 p-3", wide && "sm:col-span-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
