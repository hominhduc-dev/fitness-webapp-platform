"use client"

import { useMemo, useState } from "react"
import { Activity, Brain, Check, ChevronLeft, Dumbbell, Moon, TrendingUp, X } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatReadinessScore, readinessRingProgress } from "@/lib/fitness/readiness"
import type { VolumeRecoveryMuscle } from "@/lib/fitness/types"
import { useSetVolumeRecommendationStatus, useUpsertRecoveryCheckIn, useVolumeRecovery } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"
import { LandmarkEditor } from "./landmark-editor"
import { ReadinessTrend } from "./readiness-trend"
import { VolumeLandmarkBar, volumeZoneClass } from "./volume-landmark-bar"

const actionPriority = { deload: 0, decrease: 1, increase: 2, maintain: 3 } as const

export function vietnamDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

type CheckInOption = { description: string; label: string; value: number }

/**
 * One question per screen, answers described in words rather than a bare 1–5
 * scale — a trainee should not have to guess what "3" means at 6am.
 */
function OptionList({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string
  onChange: (value: number) => void
  options: readonly CheckInOption[]
  value: number | null
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
              selected ? "border-primary bg-primary-soft" : "border-border bg-background hover:bg-muted",
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
            </span>
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
              )}
            >
              {selected ? <Check className="size-3" /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ReadinessRing({ score, size = "size-28" }: { score: number | null; size?: string }) {
  const circumference = 2 * Math.PI * 42

  return (
    <div className={cn("relative shrink-0 text-primary", size)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - readinessRingProgress(score))}
          strokeLinecap="round"
          strokeWidth="8"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-3xl font-semibold tnum text-foreground">
        {formatReadinessScore(score)}
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
  copy: ReturnType<typeof useLocale>["messages"]["volumeRecovery"]
  muscle: VolumeRecoveryMuscle
  name: string
  zoneLabel: string
}) {
  const [editorOpen, setEditorOpen] = useState(false)
  const landmarkSource = muscle.landmarks.source === "coach"
    ? copy.landmarksCoach
    : muscle.landmarks.source === "learned"
      ? copy.landmarksLearned
      : copy.landmarksSystem

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{name}</p>
          <p className="mt-0.5 font-mono text-xs tnum text-muted-foreground">
            {muscle.effectiveSets} {copy.sets} · {muscle.directSets} {copy.directSets} · {muscle.indirectSets} {copy.indirectSets}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", volumeZoneClass(muscle.zone))}>
          {zoneLabel}
        </span>
      </div>
      <VolumeLandmarkBar className="pt-4" landmarks={muscle.landmarks} sets={muscle.effectiveSets} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {muscle.lowConfidenceSets > 0 ? (
          <p className="text-micro text-warning-text">{muscle.lowConfidenceSets} {copy.lowConfidenceSets}</p>
        ) : (
          <span className="font-mono text-micro text-muted-foreground">{landmarkSource}</span>
        )}
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {copy.editLandmarks}
        </button>
      </div>
      <LandmarkEditor muscle={muscle} muscleName={name} open={editorOpen} onClose={() => setEditorOpen(false)} />
    </div>
  )
}

const CHECK_IN_STEPS = ["sleep", "fatigue", "stress", "soreness"] as const

type CheckInStep = (typeof CHECK_IN_STEPS)[number]

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex flex-1 gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn("h-1 flex-1 rounded-full transition-colors", index <= current ? "bg-primary" : "bg-muted")}
        />
      ))}
    </div>
  )
}

export function CheckInSheet({
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
  const [stepIndex, setStepIndex] = useState(0)
  const [sleepQuality, setSleepQuality] = useState<number | null>(null)
  const [sleepHours, setSleepHours] = useState("")
  const [sleepMinutePart, setSleepMinutePart] = useState("")
  const [fatigue, setFatigue] = useState<number | null>(null)
  const [stress, setStress] = useState<number | null>(null)
  const [soreness, setSoreness] = useState<number | null>(null)

  const hasSleepDuration = sleepHours !== "" || sleepMinutePart !== ""
  const parsedSleepHours = sleepHours === "" ? 0 : Number(sleepHours)
  const parsedSleepMinutePart = sleepMinutePart === "" ? 0 : Number(sleepMinutePart)
  const sleepDurationInvalid = hasSleepDuration && !(
    Number.isInteger(parsedSleepHours) &&
    Number.isInteger(parsedSleepMinutePart) &&
    parsedSleepHours >= 0 &&
    parsedSleepHours <= 24 &&
    parsedSleepMinutePart >= 0 &&
    parsedSleepMinutePart <= 59 &&
    parsedSleepHours * 60 + parsedSleepMinutePart <= 1440
  )

  if (!open) return null

  const step: CheckInStep = CHECK_IN_STEPS[stepIndex]
  const isLastStep = stepIndex === CHECK_IN_STEPS.length - 1
  const saved = mutation.data ?? null

  // Fatigue carries the heaviest weight in the score and is NOT NULL in the
  // database, so it is the one answer a trainee cannot skip past.
  const canSkip = step !== "fatigue"
  const canAdvance = step === "sleep"
    ? !sleepDurationInvalid
    : step === "fatigue"
      ? fatigue != null
      : true

  async function submit() {
    if (fatigue == null || sleepDurationInvalid) return

    try {
      await mutation.mutateAsync({
        checkInDate: vietnamDateKey(),
        fatigue,
        // One whole-body answer, recorded against every muscle trained this
        // week — that is the granularity the volume engine reads.
        muscles: soreness == null ? [] : muscles.map((muscle) => ({ muscleSlug: muscle.muscleSlug, soreness })),
        sleepMinutes: hasSleepDuration ? parsedSleepHours * 60 + parsedSleepMinutePart : undefined,
        sleepQuality: sleepQuality ?? undefined,
        stress: stress ?? undefined,
      })
    } catch {
      // The mutation exposes its error below the question.
    }
  }

  function goNext() {
    if (isLastStep) {
      void submit()
      return
    }
    setStepIndex((index) => Math.min(index + 1, CHECK_IN_STEPS.length - 1))
  }

  if (saved) {
    return (
      <BottomSheet ariaLabel={copy.resultTitle} onClose={onClose} variant="flush" className="sm:max-h-[88svh]">
        <BottomSheetBody className="flex flex-col items-center gap-4 py-8 text-center">
          <ReadinessRing score={saved.readinessScore} size="size-36" />
          <div>
            <p className="text-lg font-semibold text-foreground">{copy.resultTitle}</p>
            <p className="mt-1 font-mono text-xs tnum text-muted-foreground">{copy.resultScale}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: Moon, label: copy.sleep, value: saved.sleepMinutes == null ? "—" : `${Math.floor(saved.sleepMinutes / 60)}h ${saved.sleepMinutes % 60}m` },
              { icon: Activity, label: copy.fatigue, value: `${saved.fatigue}/5` },
              { icon: Brain, label: copy.stress, value: saved.stress == null ? "—" : `${saved.stress}/5` },
              { icon: Dumbbell, label: copy.soreness, value: saved.muscles.length === 0 ? "—" : `${Math.max(...saved.muscles.map((muscle) => muscle.soreness))}/5` },
            ].map((item) => (
              <div key={item.label} className="rounded-md bg-surface-subtle p-3 text-left">
                <item.icon className="size-4 text-primary" aria-hidden="true" />
                <p className="mt-2 text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 font-mono font-semibold tnum text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button type="button" className="w-full" onClick={onClose}>{copy.resultDone}</Button>
        </BottomSheetFooter>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet ariaLabel={copy.formTitle} onClose={onClose} variant="flush" className="sm:max-h-[88svh]">
      <BottomSheetHeader>
        <div className="flex w-full items-center gap-3">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label={copy.back}
            >
              <ChevronLeft className="size-4" />
            </button>
          ) : null}
          <StepProgress current={stepIndex} total={CHECK_IN_STEPS.length} />
          {canSkip ? (
            <button
              type="button"
              onClick={goNext}
              className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {copy.skip}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={messages.common.closeNavigation}
          >
            <X className="size-4" />
          </button>
        </div>
      </BottomSheetHeader>

      <BottomSheetBody className="space-y-5">
        <div>
          <p className="font-mono text-micro uppercase tracking-[0.1em] text-muted-foreground">
            {copy.stepOf(stepIndex + 1, CHECK_IN_STEPS.length)}
          </p>
          <h2 className="mt-2 text-xl font-semibold leading-tight text-foreground">
            {step === "sleep" ? copy.sleepStepTitle
              : step === "fatigue" ? copy.fatigueStepTitle
                : step === "stress" ? copy.stressStepTitle
                  : copy.sorenessStepTitle}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {step === "sleep" ? copy.sleepStepHelp
              : step === "fatigue" ? copy.fatigueStepHelp
                : step === "stress" ? copy.stressStepHelp
                  : copy.sorenessStepHelp}
          </p>
        </div>

        {step === "sleep" ? (
          <>
            <OptionList
              ariaLabel={copy.sleepStepTitle}
              options={copy.checkInOptions.sleepQuality}
              value={sleepQuality}
              onChange={setSleepQuality}
            />
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">{copy.sleepDurationOptional}</span>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5" htmlFor="recovery-sleep-hours">
                  <span className="text-xs text-muted-foreground">{copy.hours}</span>
                  <Input
                    id="recovery-sleep-hours"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="24"
                    step="1"
                    aria-invalid={sleepDurationInvalid}
                    value={sleepHours}
                    onChange={(event) => setSleepHours(event.target.value)}
                    className="h-11 bg-background font-mono tnum"
                  />
                </label>
                <label className="space-y-1.5" htmlFor="recovery-sleep-minute-part">
                  <span className="text-xs text-muted-foreground">{copy.minutes}</span>
                  <Input
                    id="recovery-sleep-minute-part"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="59"
                    step="1"
                    aria-invalid={sleepDurationInvalid}
                    value={sleepMinutePart}
                    onChange={(event) => setSleepMinutePart(event.target.value)}
                    className="h-11 bg-background font-mono tnum"
                  />
                </label>
              </div>
              {sleepDurationInvalid ? (
                <p className="text-xs text-destructive-text">{copy.invalidSleepDuration}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {step === "fatigue" ? (
          <OptionList
            ariaLabel={copy.fatigueStepTitle}
            options={copy.checkInOptions.fatigue}
            value={fatigue}
            onChange={setFatigue}
          />
        ) : null}

        {step === "stress" ? (
          <OptionList
            ariaLabel={copy.stressStepTitle}
            options={copy.checkInOptions.stress}
            value={stress}
            onChange={setStress}
          />
        ) : null}

        {step === "soreness" ? (
          <>
            <OptionList
              ariaLabel={copy.sorenessStepTitle}
              options={copy.checkInOptions.soreness}
              value={soreness}
              onChange={setSoreness}
            />
            {muscles.length > 0 ? (
              <p className="text-xs text-muted-foreground">{copy.sorenessScope(muscles.length)}</p>
            ) : null}
          </>
        ) : null}

        {mutation.error ? <p className="text-sm text-destructive-text">{mutation.error.message || copy.saveError}</p> : null}
      </BottomSheetBody>

      <BottomSheetFooter>
        <Button type="button" className="w-full" disabled={!canAdvance || mutation.isPending} onClick={goNext}>
          {mutation.isPending ? copy.resultPending : isLastStep ? copy.save : copy.next}
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
  const answerRecommendation = useSetVolumeRecommendationStatus()
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
              <p className="mt-1 font-mono text-xs tnum text-muted-foreground">{copy.resultScale}</p>
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

      <ReadinessTrend />

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
          {insight.recommendation.status === "pending" ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={answerRecommendation.isPending}
                onClick={() => answerRecommendation.mutate({ muscleSlug: insight.muscleSlug, status: "accepted", weekStart: data.weekStart })}
              >
                {copy.accept}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={answerRecommendation.isPending}
                onClick={() => answerRecommendation.mutate({ muscleSlug: insight.muscleSlug, status: "dismissed", weekStart: data.weekStart })}
              >
                {copy.dismiss}
              </Button>
            </div>
          ) : (
            <p className="mt-3 font-mono text-micro uppercase tracking-[0.08em] text-primary">
              {insight.recommendation.status === "dismissed" ? copy.dismissed : copy.accepted}
            </p>
          )}
          {answerRecommendation.error ? (
            <p className="mt-2 text-sm text-destructive-text">{answerRecommendation.error.message}</p>
          ) : null}
        </section>
      ) : null}

      <CheckInSheet muscles={data.muscles} open={checkInOpen} onClose={() => setCheckInOpen(false)} />
    </div>
  )
}
