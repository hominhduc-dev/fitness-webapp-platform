import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    positive: boolean
  }
  variant?: "default" | "primary" | "accent"
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatsCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30",
        variant === "primary" && "border-primary/20 bg-primary/5",
        variant === "accent" && "border-accent/20 bg-accent/5",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "text-2xl font-bold tracking-tight",
              variant === "primary" && "text-primary",
              variant === "accent" && "text-accent",
            )}
          >
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn("text-xs font-medium", trend.positive ? "text-success" : "text-accent")}>
              {trend.positive ? "+" : ""}
              {trend.value}% from last week
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            variant === "default" && "bg-muted",
            variant === "primary" && "bg-primary/10",
            variant === "accent" && "bg-accent/10",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              variant === "default" && "text-muted-foreground",
              variant === "primary" && "text-primary",
              variant === "accent" && "text-accent",
            )}
          />
        </div>
      </div>

      {/* Decorative gradient */}
      <div
        className={cn(
          "absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-2xl",
          variant === "default" && "bg-foreground",
          variant === "primary" && "bg-primary",
          variant === "accent" && "bg-accent",
        )}
      />
    </div>
  )
}
