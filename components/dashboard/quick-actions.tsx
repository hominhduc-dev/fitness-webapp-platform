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
    <section aria-label="Quick actions" className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "glass-card group flex min-w-[104px] snap-start flex-col items-center justify-center rounded-[18px] border px-3 py-3.5 text-center transition-all hover:-translate-y-0.5 md:min-h-[108px] md:min-w-0 md:rounded-[20px] md:py-4",
            action.tone === "success" && "border-success/20 bg-ok-soft hover:border-success/30",
            action.tone === "primary" && "border-border bg-card hover:border-primary/25",
            action.tone === "neutral" && "border-border bg-card hover:border-border/80",
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full md:h-11 md:w-11",
              action.tone === "primary" && "bg-primary-soft text-primary",
              action.tone === "success" && "bg-ok-soft text-success",
              action.tone === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            <action.icon className="h-5 w-5" />
          </div>
          <p className="mt-2.5 text-[12px] font-medium leading-tight tracking-tight text-foreground md:mt-3 md:text-[13px]">
            {action.label}
          </p>
        </Link>
      ))}
    </section>
  )
}
