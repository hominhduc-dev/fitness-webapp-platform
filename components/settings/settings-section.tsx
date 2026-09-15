"use client"

import { ChevronDown, type LucideIcon } from "lucide-react"
import { useId, useState, type ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { IconTile } from "@/components/ui/icon-tile"
import { cn } from "@/lib/utils"

/**
 * One card on the settings page. The `id` doubles as the anchor `SettingsNav`
 * scrolls to, so the scroll margin here has to clear the sticky page header.
 * `collapsible` keeps a rarely used block (the reset zone) folded away without
 * giving it a second layer of card chrome.
 */
export function SettingsSection({
  children,
  className,
  collapsible = false,
  defaultOpen = false,
  description,
  icon: Icon,
  id,
  title,
  tone = "primary",
}: {
  children: ReactNode
  className?: string
  collapsible?: boolean
  defaultOpen?: boolean
  description?: ReactNode
  icon: LucideIcon
  id: string
  title: ReactNode
  tone?: "danger" | "primary"
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
        "scroll-mt-36 rounded-2xl border p-4 sm:p-5 lg:scroll-mt-28",
        isDanger ? "border-destructive/30 bg-destructive-soft" : "border-border bg-card",
        className,
      )}
    >
      <div className={cn("flex items-start gap-3", isOpen && "mb-4")}>
        <IconTile size="sm" tone={isDanger ? "surface" : "primary"} className={cn(isDanger && "text-destructive-text")}>
          <Icon strokeWidth={1.8} />
        </IconTile>

        <div className="min-w-0 flex-1">
          {/* The description sits outside the heading (and outside the toggle)
              so neither picks up the whole paragraph as its accessible name. */}
          <h2
            id={`${id}-heading`}
            className={cn("text-base font-semibold leading-8 sm:text-lg", isDanger && "text-destructive-text")}
          >
            {collapsible ? (
              <button
                type="button"
                aria-controls={bodyId}
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1">{title}</span>
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
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
          ) : null}
        </div>
      </div>

      {isOpen ? <div id={collapsible ? bodyId : undefined}>{children}</div> : null}
    </section>
  )
}

/**
 * Two columns from `sm` up, one on phones — a forced two-column grid truncates
 * select values such as "Active (6–7 days/week)" at 390px.
 */
export function SettingsFieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>
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
    <div className={cn("space-y-1.5", wide && "sm:col-span-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
