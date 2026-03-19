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
      tone: "accent",
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
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "group flex min-h-[132px] flex-col items-center justify-center rounded-[28px] border px-4 py-6 text-center shadow-sm transition-all hover:-translate-y-0.5",
            action.tone === "accent" &&
              "border-emerald-200 bg-[linear-gradient(180deg,#f4fcf7_0%,#ffffff_100%)] hover:border-emerald-300",
            action.tone === "primary" && "border-border bg-card hover:border-primary/20",
            action.tone === "neutral" && "border-border bg-card hover:border-border/80",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-105",
              action.tone === "primary" && "bg-primary/10 text-primary",
              action.tone === "accent" && "bg-emerald-100 text-emerald-600",
              action.tone === "neutral" && "bg-muted text-muted-foreground",
            )}
          >
            <action.icon className="h-5 w-5" />
          </div>
          <p className="mt-4 text-lg font-semibold tracking-tight text-foreground">{action.label}</p>
        </Link>
      ))}
    </section>
  )
}
