"use client"

import { useMemo, useState } from "react"
import { Activity, Brain, Dumbbell, Moon, TrendingUp, X } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { VolumeRecoveryMuscle, VolumeZone } from "@/lib/fitness/types"
import { useUpsertRecoveryCheckIn, useVolumeRecovery } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

const actionPriority = { deload: 0, decrease: 1, increase: 2, maintain: 3 } as const

function vietnamDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function zoneClass(zone: VolumeZone) {
  if (zone === "mav" || zone === "mev_to_mav") return "bg-success-soft text-success-text"
  if (zone === "near_mrv") return "bg-warning-soft text-warning-text"
  if (zone === "above_mrv") return "bg-destructive-soft text-destructive-text"
  return "bg-primary-soft text-primary"
}

function RatingScale({
  ariaLabel,
  minimum = 1,
  notSetLabel,
  onChange,
  optional = false,
  value,
}: {
  ariaLabel: string
  minimum?: 0 | 1
  notSetLabel: string
  onChange: (value: number | null) => void
  optional?: boolean
  value: number | null
}) {
  return (
    <div className="flex gap-1.5" role="group" aria-label={ariaLabel}>
      {optional ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-md border font-mono text-xs transition-colors",
            value == null ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground",
          )}
          aria-label={`${ariaLabel}: ${notSetLabel}`}
        >
          —
        </button>
      ) : null}
      {Array.from({ length: 6 - minimum }, (_, index) => index + minimum).map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-md border font-mono text-sm transition-colors",
            value === rating
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}
          aria-pressed={value === rating}
        >
          {rating}
        </button>
      ))}
    </div>
  )
}

function ReadinessRing({ score }: { score: number | null }) {
  const normalized = Math.max(0, Math.min(100, score ?? 0))
  const circumference = 2 * Math.PI * 42

  return (
    <div className="relative size-28 shrink-0 text-primary">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - normalized / 100)}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-semibold tnum text-foreground">
        {score ?? "—"}
      </span>
    </div>
  )
}

function MuscleVolumeRow({
  copy,
  muscle,
  name,
  zoneLabel,
}: {
  copy: { directSets: string; indirectSets: string; lowConfidenceSets: string; sets: string }
  muscle: VolumeRecoveryMuscle
  name: string
  zoneLabel: string
}) {
  const rangeMax = Math.max(muscle.landmarks.mrvSets * 1.1, 1)
  const position = Math.min(100, (muscle.effectiveSets / rangeMax) * 100)

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{name}</p>
          <p className="mt-0.5 font-mono text-xs tnum text-muted-foreground">
            {muscle.effectiveSets} {copy.sets} · {muscle.directSets} {copy.directSets} · {muscle.indirectSets} {copy.indirectSets}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", zoneClass(muscle.zone))}>
          {zoneLabel}
        </span>
      </div>
      <div className="relative pt-4">
        <div className="grid h-2 grid-cols-[40%_35%_25%] overflow-hidden rounded-full">
          <span className="bg-success" />
          <span className="bg-warning" />
          <span className="bg-destructive" />
        </div>
        <span
          className="absolute top-[0.82rem] size-3 -translate-x-1/2 rounded-full border-2 border-card bg-primary shadow-sm"
          style={{ left: `${position}%` }}
        />
        <div className="mt-2 flex justify-between font-mono text-micro tnum text-muted-foreground">
          <span>MEV {muscle.landmarks.mevSets}</span>
          <span>MAV {muscle.landmarks.mavMinSets}–{muscle.landmarks.mavMaxSets}</span>
          <span>MRV {muscle.landmarks.mrvSets}</span>
        </div>
      </div>
      {muscle.lowConfidenceSets > 0 ? (
        <p className="mt-2 text-micro text-warning-text">{muscle.lowConfidenceSets} {copy.lowConfidenceSets}</p>
      ) : null}
    </div>
  )
}

function CheckInSheet({
  muscles,
  onClose,
  open,
}: {
  muscles: VolumeRecoveryMuscle[]
  onClose: () => void
  open: boolean
}) {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const mutation = useUpsertRecoveryCheckIn()
  const [sleepQuality, setSleepQuality] = useState<number | null>(3)
  const [sleepMinutes, setSleepMinutes] = useState("480")
  const [fatigue, setFatigue] = useState<number | null>(3)
  const [stress, setStress] = useState<number | null>(null)
  const [soreness, setSoreness] = useState<Record<string, number>>({})

  if (!open) return null

  async function submit() {
    if (fatigue == null) return
    const parsedSleepMinutes = sleepMinutes === "" ? undefined : Number(sleepMinutes)
    if (parsedSleepMinutes != null && (!Number.isFinite(parsedSleepMinutes) || parsedSleepMinutes < 0 || parsedSleepMinutes > 1440)) return

    try {
      await mutation.mutateAsync({
        checkInDate: vietnamDateKey(),
        fatigue,
        muscles: muscles.map((muscle) => ({
          muscleSlug: muscle.muscleSlug,
          soreness: soreness[muscle.muscleSlug] ?? 0,
        })),
        sleepMinutes: parsedSleepMinutes,
        sleepQuality: sleepQuality ?? undefined,
        stress: stress ?? undefined,
      })
      onClose()
    } catch {
      // The mutation exposes its error below the form.
    }
  }

  return (
    <BottomSheet ariaLabel={copy.formTitle} onClose={onClose} variant="flush" className="sm:max-h-[88svh]">
      <BottomSheetHeader>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{copy.formTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.formDescription}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label={messages.common.closeNavigation}
        >
          <X className="size-4" />
        </button>
      </BottomSheetHeader>
      <BottomSheetBody className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{copy.sleepQuality}</label>
          <RatingScale ariaLabel={copy.sleepQuality} notSetLabel={copy.notSet} value={sleepQuality} onChange={setSleepQuality} />
        </div>
        <div className="space-y-2">
          <label htmlFor="recovery-sleep-minutes" className="text-sm font-medium text-foreground">{copy.sleepMinutes}</label>
          <Input
            id="recovery-sleep-minutes"
            type="number"
            min="0"
            max="1440"
            value={sleepMinutes}
            onChange={(event) => setSleepMinutes(event.target.value)}
            className="h-11 bg-background font-mono tnum"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{copy.fatigueLevel}</label>
          <RatingScale ariaLabel={copy.fatigueLevel} notSetLabel={copy.notSet} value={fatigue} onChange={setFatigue} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{copy.stressLevel}</label>
          <RatingScale ariaLabel={copy.stressLevel} notSetLabel={copy.notSet} value={stress} onChange={setStress} optional />
        </div>
        {muscles.length > 0 ? (
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-foreground">{copy.muscleSoreness}</legend>
            {muscles.map((muscle) => {
              const label = copy.muscleLabels[muscle.muscleSlug as keyof typeof copy.muscleLabels] ?? muscle.muscleSlug
              return (
                <div key={muscle.muscleSlug} className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <span className="text-sm text-foreground">{label}</span>
                  <RatingScale
                    ariaLabel={`${copy.muscleSoreness}: ${label}`}
                    minimum={0}
                    notSetLabel={copy.notSet}
                    value={soreness[muscle.muscleSlug] ?? 0}
                    onChange={(value) => setSoreness((current) => ({ ...current, [muscle.muscleSlug]: value ?? 0 }))}
                  />
                </div>
              )
            })}
          </fieldset>
        ) : null}
        {mutation.error ? <p className="text-sm text-destructive-text">{mutation.error.message || copy.saveError}</p> : null}
      </BottomSheetBody>
      <BottomSheetFooter>
        <Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button>
        <Button type="button" disabled={mutation.isPending || fatigue == null} onClick={() => void submit()}>
          {mutation.isPending ? copy.saving : copy.save}
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  )
}

function VolumeRecoverySkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-44 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
      <div className="grid grid-cols-3 gap-2"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
    </div>
  )
}

export function VolumeRecoveryPanel() {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const query = useVolumeRecovery()
  const [checkInOpen, setCheckInOpen] = useState(false)
  const data = query.data
  const insight = useMemo(
    () => data?.muscles.slice().sort((left, right) => actionPriority[left.recommendation.action] - actionPriority[right.recommendation.action])[0] ?? null,
    [data],
  )

  if (query.isPending) return <VolumeRecoverySkeleton />
  if (query.error || !data) {
    return <div className="rounded-lg border border-destructive/20 bg-destructive-soft p-4 text-sm text-destructive-text">{query.error?.message ?? copy.noVolume}</div>
  }

  const readinessLabel = data.readiness.label === "ready"
    ? copy.ready
    : data.readiness.label === "moderate"
      ? copy.moderate
      : data.readiness.label === "low"
        ? copy.low
        : copy.insufficient

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <ReadinessRing score={data.readiness.score} />
            <div>
              <p className="label-micro">{copy.readiness}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{readinessLabel}</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.confidence}: {data.confidence.label === "medium" ? copy.confidenceMedium : copy.confidenceLow}
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => setCheckInOpen(true)}>
            {data.checkIn ? copy.updateCheckIn : copy.checkIn}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { icon: Dumbbell, label: copy.hardSets, value: data.summary.hardSets },
          { icon: Activity, label: copy.avgRir, value: data.summary.averageRir ?? "—" },
          { icon: TrendingUp, label: copy.performance, value: data.summary.performanceChangePct == null ? "—" : `${data.summary.performanceChangePct > 0 ? "+" : ""}${data.summary.performanceChangePct}%` },
        ].map((item) => (
          <div key={item.label} className="min-w-0 rounded-lg border border-border bg-card p-3 sm:p-4">
            <item.icon className="mb-3 size-4 text-primary" aria-hidden="true" />
            <p className="truncate text-micro text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-mono text-xl font-semibold tnum text-foreground sm:text-2xl">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">{copy.weeklyVolume}</h2>
        {data.muscles.length > 0 ? data.muscles.map((muscle) => {
          const name = copy.muscleLabels[muscle.muscleSlug as keyof typeof copy.muscleLabels] ?? muscle.muscleSlug
          return <MuscleVolumeRow key={muscle.muscleSlug} copy={copy} muscle={muscle} name={name} zoneLabel={copy.zones[muscle.zone]} />
        }) : <p className="mt-4 text-sm text-muted-foreground">{copy.noVolume}</p>}
      </section>

      {data.checkIn ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">{copy.recoverySignals}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Moon, label: copy.sleep, value: data.checkIn.sleepMinutes ? `${Math.floor(data.checkIn.sleepMinutes / 60)}h ${data.checkIn.sleepMinutes % 60}m` : "—" },
              { icon: Activity, label: copy.fatigue, value: `${data.checkIn.fatigue}/5` },
              { icon: Brain, label: copy.stress, value: data.checkIn.stress ? `${data.checkIn.stress}/5` : "—" },
              { icon: Dumbbell, label: copy.soreness, value: data.checkIn.muscles.length ? `${Math.max(...data.checkIn.muscles.map((muscle) => muscle.soreness))}/5` : "—" },
            ].map((item) => (
              <div key={item.label} className="rounded-md bg-surface-subtle p-3">
                <item.icon className="size-4 text-primary" aria-hidden="true" />
                <p className="mt-3 text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-mono font-semibold tnum text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {insight ? (
        <section className="rounded-lg border border-primary/20 bg-primary-soft p-5">
          <p className="label-micro text-primary">{copy.coachInsight}</p>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {copy.recommendation(
              insight.recommendation.action,
              copy.muscleLabels[insight.muscleSlug as keyof typeof copy.muscleLabels] ?? insight.muscleSlug,
            )}
          </p>
        </section>
      ) : null}

      <CheckInSheet muscles={data.muscles} open={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </div>
  )
}
