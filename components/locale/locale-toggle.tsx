"use client"

import { Languages } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

export function LocaleToggle({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { locale, messages, setLocale } = useLocale()

  const handleLocaleChange = (nextLocale: "en" | "vi") => {
    if (locale === nextLocale) {
      return
    }

    setLocale(nextLocale)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/85 p-1 shadow-sm backdrop-blur",
        compact && "border-border bg-card/90",
      )}
      aria-label={messages.common.language}
    >
      {!compact ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground">
          <Languages className="h-4 w-4" />
        </div>
      ) : null}

      {(["en", "vi"] as const).map((option) => {
        const isActive = locale === option

        return (
          <button
            key={option}
            type="button"
            onClick={() => handleLocaleChange(option)}
            disabled={isPending}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-all",
              isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "en" ? messages.common.english : messages.common.vietnamese}
          </button>
        )
      })}
    </div>
  )
}
