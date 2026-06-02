"use client"

import type { LucideIcon } from "lucide-react"
import {
  BellRing,
  Calendar,
  ClipboardList,
  Dumbbell,
  Flame,
  ShieldCheck,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"

const iconMap = {
  "bell-ring": BellRing,
  calendar: Calendar,
  "clipboard-list": ClipboardList,
  dumbbell: Dumbbell,
  flame: Flame,
  "shield-check": ShieldCheck,
  target: Target,
  "trending-up": TrendingUp,
  "user-plus": UserPlus,
  users: Users,
} satisfies Record<string, LucideIcon>

type StatsCardIconName = keyof typeof iconMap

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  iconName?: StatsCardIconName
  trend?: {
    value: number
    positive: boolean
  }
  variant?: "default" | "primary" | "accent"
}

export function StatsCard({ title, value, subtitle, icon, iconName, trend, variant = "default" }: StatsCardProps) {
  const Icon = icon ?? (iconName ? iconMap[iconName] : undefined)

  return (
    <div
      className={cn(
        "rounded-[10px] border bg-card p-4 transition-colors hover:border-primary/25 md:p-5",
        variant === "default" && "border-border",
        variant === "primary" && "border-primary/20 bg-primary-soft",
        variant === "accent"  && "border-success/20 bg-ok-soft",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="label-micro">{title}</p>
          <p
            className={cn(
              "font-mono text-2xl font-semibold leading-none tracking-tight tnum",
              variant === "default" && "text-foreground",
              variant === "primary" && "text-primary",
              variant === "accent"  && "text-success",
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <span
              className={cn(
                "inline-flex rounded-sm px-1.5 py-0.5 font-mono text-[10px] tnum",
                trend.positive
                  ? "bg-ok-soft text-success"
                  : "bg-warn-soft text-warning",
              )}
            >
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]",
              variant === "default" && "bg-muted text-muted-foreground",
              variant === "primary" && "bg-primary-soft text-primary",
              variant === "accent"  && "bg-ok-soft text-success",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  )
}
