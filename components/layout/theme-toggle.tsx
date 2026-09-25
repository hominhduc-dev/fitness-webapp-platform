"use client"

import { Dumbbell, Flame, Leaf, Monitor, Moon, Sun, Trophy, Zap, type LucideIcon } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { useTheme, type ThemeMode } from "@/components/providers/theme-provider"
import { GlassSegmented } from "@/components/ui/glass-segmented"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  compact?: boolean
  className?: string
  variant?: "select" | "toggle"
}

export function ThemeToggle({ compact = false, className, variant = "toggle" }: ThemeToggleProps) {
  const { messages } = useLocale()
  const { setTheme, theme } = useTheme()

  const options: Array<{ icon: LucideIcon; label: string; value: ThemeMode }> = [
    { icon: Sun, label: messages.common.themeLight, value: "light" },
    { icon: Leaf, label: messages.common.themePerformanceGreen, value: "performance-green" },
    { icon: Zap, label: messages.common.themeElectricBlue, value: "electric-blue" },
    { icon: Zap, label: messages.common.themeVoltLime, value: "volt-lime" },
    { icon: Flame, label: messages.common.themeIronOrange, value: "iron-orange" },
    { icon: Dumbbell, label: messages.common.themeBlackVolt, value: "black-volt" },
    { icon: Trophy, label: messages.common.themeCrimsonPerformance, value: "crimson-performance" },
    { icon: Moon, label: messages.common.themeDark, value: "dark" },
    { icon: Monitor, label: messages.common.themeSystem, value: "system" },
  ]

  if (variant === "select" || compact) {
    return (
      <Select value={theme} onValueChange={(value) => setTheme(value as ThemeMode)}>
        <SelectTrigger aria-label={messages.common.theme} className={cn("w-full bg-muted/50", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="glass-surface">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <option.icon className="h-4 w-4" />
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div
      aria-label={messages.common.theme}
      className={cn(
        "inline-flex rounded-md bg-muted/70 p-0.5",
        compact ? "w-full" : "w-auto",
        className,
      )}
      role="group"
    >
      {/* No slide: the options wrap onto rows, and a drag reads one axis only. */}
      <GlassSegmented
        activeIndex={options.findIndex((option) => option.value === theme)}
        lensClassName="rounded-md"
        className="grid w-full grid-cols-2 gap-0.5 sm:grid-cols-3"
      >
        {(shownIndex) =>
          options.map((option, index) => {
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                data-segment
                aria-label={option.label}
                aria-pressed={theme === option.value}
                title={option.label}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 font-mono text-micro font-semibold uppercase tracking-[0.08em] transition-colors",
                  index === shownIndex ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTheme(option.value)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{option.label}</span>
              </button>
            )
          })
        }
      </GlassSegmented>
    </div>
  )
}
