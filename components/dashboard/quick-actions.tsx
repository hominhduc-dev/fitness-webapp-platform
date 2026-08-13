"use client"

import Link from "next/link"
import { Calendar, Scale, Sparkles, TrendingUp, Utensils } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

export function QuickActions() {
  const { messages } = useLocale()

  const actions = [
    {
      href: "/trackweight",
      icon: Scale,
      label: messages.dashboard.quickLogWeight,
      tone: "primary",
    },
    {
      href: "/meals",
      icon: Utensils,
      label: messages.dashboard.logMeal,
      tone: "success",
    },
    {
      href: "/schedule",
      icon: Calendar,
      label: messages.dashboard.schedule,
      tone: "primary",
    },
    {
      href: "/progress",
      icon: TrendingUp,
      label: messages.dashboard.progress,
      tone: "neutral",
    },
    {
      href: "/workout/ai-generate",
      icon: Sparkles,
      label: "AI Coach",
      tone: "primary",
    },
  ] as const

  return (
    <section aria-label="Quick actions" className="grid grid-cols-5 gap-1.5 md:gap-2.5">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "glass-card group flex min-w-0 flex-col items-center justify-center rounded-[16px] border px-1 py-3 text-center transition-all hover:-translate-y-0.5 md:min-h-[108px] md:rounded-[20px] md:px-3 md:py-4",
            action.tone === "success" && "border-success/20 bg-ok-soft hover:border-success/30",
            action.tone === "primary" && "border-border bg-card hover:border-primary/25",
            action.tone === "neutral" && "border-border bg-card hover:border-border/80",
          )}
        >
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full md:h-11 md:w-11",
              action.tone === "primary" && "bg-primary-soft text-primary",
              action.tone === "success" && "bg-ok-soft text-success",
              action.tone === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            <action.icon className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <p className="mt-2 line-clamp-2 text-[10px] font-medium leading-[1.15] tracking-tight text-foreground md:mt-3 md:text-[13px]">
            {action.label}
          </p>
        </Link>
      ))}
    </section>
  )
}
