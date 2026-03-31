"use client"

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
import type { LucideIcon } from "lucide-react"
import { useLocale } from "@/components/providers/locale-provider"

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
  const { locale } = useLocale()
  const Icon = icon ?? (iconName ? iconMap[iconName] : undefined)

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[24px] border p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_24px_55px_-34px_rgba(15,23,42,0.24)] sm:p-5",
        variant === "default" && "border-slate-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]",
        variant === "primary" && "border-primary/15 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]",
        variant === "accent" && "border-accent/15 bg-[linear-gradient(180deg,rgba(34,197,94,0.05)_0%,#ffffff_100%)]",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p
            className={cn(
              "text-2xl font-black tracking-tight sm:text-3xl",
              variant === "default" && "text-slate-950",
              variant === "primary" && "text-primary",
              variant === "accent" && "text-accent",
            )}
          >
            {value}
          </p>
          {subtitle && <p className="max-w-[15rem] text-xs leading-5 text-slate-500">{subtitle}</p>}
          {trend && (
            <p className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", trend.positive ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
              {trend.positive ? "+" : ""}
              {trend.value}% {locale === "en" ? "from last week" : "so với tuần trước"}
            </p>
          )}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105",
              variant === "default" && "bg-slate-100",
              variant === "primary" && "bg-primary/10",
              variant === "accent" && "bg-accent/10",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                variant === "default" && "text-slate-500",
                variant === "primary" && "text-primary",
                variant === "accent" && "text-accent",
              )}
            />
          </div>
        ) : null}
      </div>

      {/* Decorative gradient */}
      <div
        className={cn(
          "absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-3xl",
          variant === "default" && "bg-slate-300",
          variant === "primary" && "bg-primary",
          variant === "accent" && "bg-accent",
        )}
      />
    </div>
  )
}
