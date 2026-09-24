"use client"

import { isSameDay } from "date-fns"
import { ArrowRight, Scale, Sun } from "lucide-react"
import { useState, type FormEvent } from "react"

import { CheckInSheet } from "@/components/progress/volume-recovery/volume-recovery-panel"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { convertWeightToKg, formatWeight } from "@/lib/fitness/weight"
import { useCreateWeightEntry, useVolumeRecovery, useWeightEntries } from "@/lib/queries/progress"
import { formatDateKey } from "@/lib/time-zone"
import { CoachInsightCard } from "./coach-insight"
import { DailyTaskCard } from "./daily-task-card"

/** Enough history for "last weigh-in" without a second request. */
const RECENT_WEIGHT_DAYS = 30

/**
 * Today tasks: one dashboard slot that walks the trainee through the day's
 * to-dos in order, each a `DailyTaskCard` done in place. It shows the check-in
 * first; once that is done, today's weigh-in takes the same slot; once that is
 * logged too, the coach's recommendation the check-in unlocked.
 */
export function TodayTasks() {
  const recovery = useVolumeRecovery()
  const weights = useWeightEntries(RECENT_WEIGHT_DAYS)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const data = recovery.data

  if (!data) return null

  // `checkIn` is the latest one this week, not necessarily today's.
  const checkedInToday = data.checkIn?.checkInDate === formatDateKey(new Date())
  const loggedWeightToday = weights.data?.some((entry) => isSameDay(entry.recordedAt, new Date())) ?? false

  return (
    <>
      {!checkedInToday ? (
        <CheckInTask onStart={() => setCheckInOpen(true)} />
      ) : !weights.data ? null : !loggedWeightToday ? (
        <WeighInTask entries={weights.data} />
      ) : (
        <CoachInsightCard />
      )}
      {/* Stays mounted after saving, even as the slot moves on, so the sheet
          can show its result screen. */}
      <CheckInSheet muscles={data.muscles} open={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </>
  )
}

function CheckInTask({ onStart }: { onStart: () => void }) {
  const { messages } = useLocale()
  const copy = messages.dashboard

  return (
    <DailyTaskCard
      icon={Sun}
      tone="warning"
      title={copy.checkInTitle}
      description={copy.checkInShort}
      data-tour="dashboard-check-in"
    >
      <Button type="button" onClick={onStart} className="h-9 gap-1 rounded-xl px-3">
        {copy.checkInAction}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </DailyTaskCard>
  )
}

function WeighInTask({ entries }: { entries: BodyMetricEntry[] }) {
  const { messages } = useLocale()
  const copy = messages.dashboard
  const { profile } = useAuth()
  const unit = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"
  const createEntry = useCreateWeightEntry()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  const latest = [...entries].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0]
  const latestLabel = latest?.weightKg != null ? `${formatWeight(latest.weightKg, unit)} ${unit}` : null
  const parsed = Number(value.replace(",", "."))
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed > 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    setError(null)
    try {
      // Saving refreshes the list, which now has today's entry, so the slot moves on.
      await createEntry.mutateAsync({
        recordedAt: new Date().toISOString(),
        weightKg: Number(convertWeightToKg(parsed, unit).toFixed(2)),
      })
      setValue("")
    } catch {
      setError(copy.weighInError)
    }
  }

  return (
    <DailyTaskCard
      icon={Scale}
      tone="primary"
      title={copy.weighInTitle}
      description={
        error ? (
          <span className="text-destructive-text">{error}</span>
        ) : latestLabel ? (
          copy.weighInLast(latestLabel)
        ) : (
          copy.weighInHint
        )
      }
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <label className="flex h-9 items-center gap-1 rounded-xl border border-border bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
          <input
            aria-label={copy.weighInInputLabel(unit)}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={latest?.weightKg != null ? formatWeight(latest.weightKg, unit) : "0.0"}
            className="w-14 bg-transparent! text-right font-mono text-sm text-foreground tnum outline-none placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </label>
        <Button type="submit" disabled={!valid || createEntry.isPending} className="h-9 rounded-xl px-3">
          {createEntry.isPending ? copy.weighInSaving : copy.weighInSave}
        </Button>
      </form>
    </DailyTaskCard>
  )
}
