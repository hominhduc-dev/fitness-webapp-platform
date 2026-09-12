"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

export type MetricCardTone = "primary" | "success" | "warning" | "violet" | "neutral"

const tonePalette = {
  primary: {
    accent: "bg-primary",
    border: "border-primary/20",
    bg: "bg-primary-soft",
    glow: "bg-primary/15",
    icon: "bg-primary-soft text-primary",
    iconBorder: "border-primary/25 bg-primary/12 text-primary",
    value: "text-primary",
  },
  success: {
    accent: "bg-success",
    border: "border-success/20",
    bg: "bg-ok-soft",
    glow: "bg-success/15",
    icon: "bg-ok-soft text-success-text",
    iconBorder: "border-success/25 bg-success/12 text-success-text",
    value: "text-success-text",
  },
  warning: {
    accent: "bg-warning",
    border: "border-warning/20",
    bg: "bg-warn-soft",
    glow: "bg-warning/15",
    icon: "bg-warn-soft text-warning-text",
    iconBorder: "border-warning/25 bg-warning/12 text-warning-text",
    value: "text-warning-text",
  },
  violet: {
    accent: "bg-chart-4",
    border: "border-chart-4/20",
    bg: "bg-chart-4/5",
    glow: "bg-chart-4/15",
    icon: "bg-chart-4/10 text-chart-4",
    iconBorder: "border-chart-4/25 bg-chart-4/10 text-chart-4",
    value: "text-chart-4",
  },
  neutral: {
    accent: "bg-muted-foreground",
    border: "border-border",
    bg: "bg-card",
    glow: "bg-muted/30",
    icon: "bg-muted text-muted-foreground",
    iconBorder: "border-border bg-muted text-muted-foreground",
    value: "text-foreground",
  },
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  tone?: MetricCardTone
  variant?: "default" | "glass" | "featured"
  progress?: number
  trend?: { value: number; positive: boolean }
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "neutral",
  variant = "default",
  progress,
  trend,
  className,
  ...props
}: MetricCardProps) {
  const palette = tonePalette[tone]
  const isDefault = variant === "default"
  const isGlass = variant === "glass"
  const isFeatured = variant === "featured"

  const safeProgress = progress !== undefined ? Math.min(Math.max(progress, 0), 100) : undefined

  return (
    <div
      data-slot="metric-card"
      className={cn(
        "flex flex-col",
        // Container classes by variant
        isDefault && "rounded-xl border border-border bg-card p-[18px]",
        isGlass && "glass-card rounded-xl border p-4 transition-all md:p-5",
        isGlass && palette.border,
        isGlass && palette.bg,
        isFeatured && "group relative overflow-hidden rounded-xl border border-border/75 bg-card/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg sm:p-5",
        className
      )}
      {...props}
    >
      {/* Featured accent stripe */}
      {isFeatured && (
        <div className={cn("absolute inset-x-0 top-0 h-0.5", palette.accent)} />
      )}

      {/* Featured glow blob */}
      {isFeatured && (
        <div className={cn("absolute -right-12 -top-12 h-32 w-32 rounded-full blur-[40px] transition-all opacity-50 group-hover:opacity-75 pointer-events-none", palette.glow)} />
      )}

      <div className="relative flex items-center justify-between gap-4">
        <h3 className="label-micro">{title}</h3>
        
        {Icon && isGlass && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", palette.icon)}>
            <Icon className="size-4" />
          </div>
        )}
        
        {Icon && isFeatured && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm", palette.iconBorder)}>
            <Icon className="size-4" />
          </div>
        )}
      </div>

      <div className="relative mt-3 flex flex-col gap-1">
        <div className={cn(
          // Typography classes by variant
          isDefault && "font-mono text-3xl font-semibold leading-none tracking-tight tnum",
          isDefault && palette.value,
          isGlass && "font-mono text-2xl font-semibold leading-none tracking-tight tnum md:text-3xl text-foreground",
          isFeatured && "font-mono text-4xl font-bold leading-none tracking-[-0.06em] tnum sm:text-5xl",
          isFeatured && palette.value
        )}>
          {value}
        </div>
        
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {trend && (
              <span className={cn(
                "inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-micro font-medium tnum",
                trend.positive 
                  ? "bg-success/15 text-success-text" 
                  : "bg-destructive/15 text-destructive"
              )}>
                {trend.positive ? "+" : "-"}{Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && (
              <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-auto flex items-center pt-3" aria-hidden>
          <span className="h-1 w-full overflow-hidden rounded-full bg-border/80">
            <span 
              className={cn("block h-full rounded-full transition-[width] duration-500", palette.accent)} 
              style={{ width: `${safeProgress}%` }} 
            />
          </span>
        </div>
      )}
    </div>
  )
}
