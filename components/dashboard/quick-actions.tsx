"use client"

import Link from "next/link"
import { Calendar, Scale, Sparkles, TrendingUp, Utensils } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"

export function QuickActions({ onOpenAIChat }: { onOpenAIChat: () => void }) {
  const { messages } = useLocale()
  const copy = messages.dashboard

  const actions: Array<
    | { href: string; icon: LucideIcon; label: string; onClick?: never }
    | { href?: never; icon: LucideIcon; label: string; onClick: () => void }
  > = [
    { href: "/trackweight", icon: Scale, label: copy.quickLogWeight },
    { href: "/meals", icon: Utensils, label: copy.logMeal },
    { href: "/schedule", icon: Calendar, label: copy.schedule },
    { href: "/progress", icon: TrendingUp, label: copy.progress },
    { icon: Sparkles, label: copy.aiCoach, onClick: onOpenAIChat },
  ]

  const actionClassName = "group flex min-h-[4.75rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-transparent bg-surface-subtle px-1 py-2 text-center transition-all hover:border-primary/20 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <section aria-labelledby="dashboard-quick-actions">
      <h2 id="dashboard-quick-actions" className="mb-2 text-base font-semibold text-foreground">
        {copy.quickActions}
      </h2>
      <div className="grid grid-cols-5 gap-2 md:gap-3">
        {actions.map((action) => {
          const content = <>
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-translate-y-0.5 md:size-10">
              <action.icon className="size-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="line-clamp-2 text-[0.6875rem] font-medium leading-tight text-foreground md:text-xs">
              {action.label}
            </span>
          </>

          return action.href ? (
            <Link key={action.label} href={action.href} className={actionClassName}>
              {content}
            </Link>
          ) : (
            <button key={action.label} type="button" onClick={action.onClick} className={actionClassName}>
              {content}
            </button>
          )
        })}
      </div>
    </section>
  )
}
