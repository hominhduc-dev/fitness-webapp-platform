"use client"

import Link from "next/link"
import { Calendar, Scale, TrendingUp, Utensils } from "lucide-react"

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
  ] as const

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "group flex min-h-[112px] flex-col items-center justify-center rounded-[10px] border px-3 py-4 text-center transition-colors md:min-h-[132px]",
            action.tone === "success" && "border-success/20 bg-ok-soft hover:border-success/30",
            action.tone === "primary" && "border-border bg-card hover:border-primary/25",
            action.tone === "neutral" && "border-border bg-card hover:border-border/80",
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-[8px] md:h-12 md:w-12",
              action.tone === "primary" && "bg-primary-soft text-primary",
              action.tone === "success" && "bg-ok-soft text-success",
              action.tone === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            <action.icon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-[13px] font-medium tracking-tight text-foreground md:mt-4 md:text-sm">
            {action.label}
          </p>
        </Link>
      ))}
    </section>
  )
}
