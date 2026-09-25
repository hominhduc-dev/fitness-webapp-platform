"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { GlassSegmented } from "@/components/ui/glass-segmented"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AppLocale } from "@/lib/i18n/config"
import { cn } from "@/lib/utils"

type LanguageToggleProps = {
  compact?: boolean
  className?: string
  variant?: "select" | "toggle"
}

export function LanguageToggle({ compact = false, className, variant = "toggle" }: LanguageToggleProps) {
  const { locale, messages, setLocale } = useLocale()

  const options: Array<{ fullLabel: string; label: string; value: AppLocale }> = [
    { fullLabel: "English", label: messages.common.english, value: "en" },
    { fullLabel: "Tiếng Việt", label: messages.common.vietnamese, value: "vi" },
  ]

  if (variant === "select") {
    return (
      <Select value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
        <SelectTrigger
          aria-label={messages.common.language}
          className={cn("glass-language-select w-full bg-muted/50", className)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="glass-surface">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.fullLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div
      aria-label={messages.common.language}
      className={cn(
        "inline-flex rounded-md bg-muted/70 p-0.5",
        compact ? "w-full" : "w-auto",
        className,
      )}
      role="group"
    >
      <GlassSegmented
        activeIndex={options.findIndex((option) => option.value === locale)}
        lensClassName="rounded-md"
        onSlide={(index) => setLocale(options[index].value)}
        className={cn("gap-0.5", compact ? "grid w-full grid-cols-2" : "inline-flex")}
      >
        {(shownIndex) =>
          options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              data-segment
              aria-pressed={locale === option.value}
              className={cn(
                "h-7 rounded-md px-2.5 font-mono text-micro font-semibold uppercase tracking-[0.08em] transition-colors",
                index === shownIndex ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLocale(option.value)}
            >
              {option.label}
            </button>
          ))
        }
      </GlassSegmented>
    </div>
  )
}
