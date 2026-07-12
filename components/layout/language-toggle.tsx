"use client"

import { useLocale } from "@/components/providers/locale-provider"
import type { AppLocale } from "@/lib/i18n/config"
import { cn } from "@/lib/utils"

type LanguageToggleProps = {
  compact?: boolean
  className?: string
}

export function LanguageToggle({ compact = false, className }: LanguageToggleProps) {
  const { locale, messages, setLocale } = useLocale()

  const options: Array<{ label: string; value: AppLocale }> = [
    { label: messages.common.english, value: "en" },
    { label: messages.common.vietnamese, value: "vi" },
  ]

  return (
    <div
      aria-label={messages.common.language}
      className={cn(
        "inline-flex rounded-[7px] bg-muted/70 p-0.5",
        compact ? "w-full" : "w-auto",
        className,
      )}
      role="group"
    >
      <div className={cn("gap-0.5", compact ? "grid w-full grid-cols-2" : "inline-flex")}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={locale === option.value}
            className={cn(
              "h-7 rounded-[6px] px-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors",
              locale === option.value
                ? "bg-background text-foreground shadow-[0_1px_2px_rgba(13,13,11,0.08)] ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setLocale(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
