"use client"

import { Trophy } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import type { StrengthCard } from "@/lib/fitness/progress-overview"
import { cn } from "@/lib/utils"

import { Sparkline } from "./sparkline"

/** The tracked lifts: current e1RM, the period's change, the trend and a PR badge. */
export function StrengthList({ cards, unit }: { cards: StrengthCard[]; unit: string }) {
  const { locale, messages } = useLocale()
  const copy = messages.progressPage.overview.strength
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const visible = cards.filter((card) => card.values.length > 0)

  if (visible.length === 0) return <p className="py-6 text-sm text-muted-foreground">{copy.empty}</p>

  return (
    <ul className="divide-y divide-border">
      {visible.map((card) => (
        <li key={card.key} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">{card.exerciseName}</span>
              {card.hasRecentPR ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning-soft px-1.5 py-px text-[10px] font-semibold text-warning-text">
                  <Trophy className="size-3" aria-hidden="true" />
                  {copy.newPR}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {card.current == null ? "—" : number.format(card.current)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
              {card.changePct != null ? (
                <span
                  className={cn(
                    "ml-2 text-xs font-semibold tnum",
                    card.changePct > 0 ? "text-success-text" : card.changePct < 0 ? "text-destructive-text" : "text-muted-foreground",
                  )}
                >
                  {card.changePct > 0 ? "▲ +" : card.changePct < 0 ? "▼ " : ""}{card.changePct}%
                </span>
              ) : null}
            </p>
          </div>
          <Sparkline values={card.values} className="h-8 w-24 shrink-0 text-primary" />
        </li>
      ))}
    </ul>
  )
}
