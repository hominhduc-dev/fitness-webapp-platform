"use client"

import { Droplets, Monitor, Moon, Sun, type LucideIcon } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { useTheme, type ThemeMode } from "@/components/providers/theme-provider"
import { cn } from "@/lib/utils"

type ThemeToggleProps = {
  compact?: boolean
  className?: string
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { messages } = useLocale()
  const { setTheme, theme } = useTheme()

  const options: Array<{ icon: LucideIcon; label: string; value: ThemeMode }> = [
    { icon: Sun, label: messages.common.themeLight, value: "light" },
    { icon: Moon, label: messages.common.themeDark, value: "dark" },
    { icon: Droplets, label: messages.common.themeGlass, value: "glass" },
    { icon: Monitor, label: messages.common.themeSystem, value: "system" },
  ]

  return (
    <div
      aria-label={messages.common.theme}
      className={cn(
        "inline-flex rounded-[7px] bg-muted/70 p-0.5",
        compact ? "w-full" : "w-auto",
        className,
      )}
      role="group"
    >
      <div className={cn("gap-0.5", compact ? "grid w-full grid-cols-4" : "inline-flex")}>
        {options.map((option) => {
          const Icon = option.icon
          const active = theme === option.value

          return (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={active}
              title={option.label}
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1 rounded-[6px] px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors",
                active
                  ? "bg-background text-foreground shadow-[0_1px_2px_rgba(13,13,11,0.08)] ring-1 ring-border/60"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTheme(option.value)}
            >
              <Icon className="h-3.5 w-3.5" />
              {!compact ? <span>{option.label}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
