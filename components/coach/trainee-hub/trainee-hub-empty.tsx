"use client"

import { Users } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"

export function TraineeHubEmpty() {
  const { messages } = useLocale()
  const copy = messages.traineeHub

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Users className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{copy.emptyTitle}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{copy.emptyCopy}</p>
    </div>
  )
}
