import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const TONE_CLASS = {
  primary: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning-text",
} as const

interface DailyTaskCardProps {
  icon: LucideIcon
  tone: keyof typeof TONE_CLASS
  title: string
  /** One line; truncated rather than wrapped so the card keeps its height. */
  description?: ReactNode
  /** The task's action, on the right: a button or a small inline form. */
  children: ReactNode
  className?: string
  "data-tour"?: string
}

/**
 * One compact row in the dashboard's Today tasks (`TodayTasks`): something the
 * trainee should do today, done in place, that disappears once it is done.
 */
export function DailyTaskCard({ icon: Icon, tone, title, description, children, className, ...rest }: DailyTaskCardProps) {
  return (
    <section
      className={cn("flex min-w-0 items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 md:gap-3 md:px-4", className)}
      {...rest}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TONE_CLASS[tone])}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </section>
  )
}
