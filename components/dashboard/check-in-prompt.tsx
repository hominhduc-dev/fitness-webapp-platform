"use client"

import { ArrowRight, Sun } from "lucide-react"
import { useState } from "react"

import { CheckInSheet } from "@/components/progress/volume-recovery/volume-recovery-panel"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { useVolumeRecovery } from "@/lib/queries/progress"
import { formatDateKey } from "@/lib/time-zone"

export function CheckInPrompt() {
  const { messages } = useLocale()
  const copy = messages.dashboard
  const query = useVolumeRecovery()
  const [open, setOpen] = useState(false)
  const data = query.data

  if (!data) return null

  // `checkIn` is the latest one this week, not necessarily today's.
  const checkedInToday = data.checkIn?.checkInDate === formatDateKey(new Date())

  return (
    <>
      {checkedInToday ? null : (
        <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 md:gap-4 md:px-4 md:py-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-text">
            <Sun className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">{copy.checkInTitle}</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground md:text-sm">{copy.checkInCopy}</p>
          </div>
          <Button type="button" onClick={() => setOpen(true)} className="h-10 shrink-0 gap-1.5 rounded-xl px-3.5 md:px-5">
            {copy.startCheckIn}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </section>
      )}
      {/* Stays mounted after saving so the sheet can show the result screen. */}
      <CheckInSheet muscles={data.muscles} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
