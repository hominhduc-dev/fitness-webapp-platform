"use client"

import { Languages } from "lucide-react"

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
        "inline-flex items-center gap-1 rounded-md border border-border bg-background p-1",
        compact ? "w-full justify-between" : "w-auto",
        className,
      )}
      role="group"
    >
      {compact ? <Languages className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      <div className="inline-flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={locale === option.value}
            className={cn(
              "rounded px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors",
              locale === option.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
