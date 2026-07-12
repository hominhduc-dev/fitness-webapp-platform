"use client"

import Link from "next/link"
import { Dumbbell, Utensils, Calendar, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const actions = [
  {
    href: "/workout/quick",
    icon: Dumbbell,
    label: "Quick Workout",
    color: "primary",
  },
  {
    href: "/meals/add",
    icon: Utensils,
    label: "Log Meal",
    color: "secondary",
  },
  {
    href: "/schedule",
    icon: Calendar,
    label: "Schedule",
    color: "accent",
  },
  {
    href: "/progress",
    icon: TrendingUp,
    label: "Progress",
    color: "info",
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
            "active:scale-[0.98]",
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
              action.color === "primary" && "bg-primary/10 text-primary group-hover:bg-primary/20",
              action.color === "secondary" && "bg-secondary/10 text-secondary group-hover:bg-secondary/20",
              action.color === "accent" && "bg-accent/10 text-accent group-hover:bg-accent/20",
              action.color === "info" && "bg-info/10 text-info group-hover:bg-info/20",
            )}
          >
            <action.icon className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium">{action.label}</span>
        </Link>
      ))}
    </div>
  )
}
