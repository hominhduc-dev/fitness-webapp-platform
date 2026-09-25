"use client"

import { useGenerateAIProgram, useAcceptAIProgram, useGenerateAIDailyWorkout, useAcceptAIDailyWorkout, useAIExerciseLibrary } from "@/lib/queries/ai"

import { ArrowLeft, Bot } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useMemo, useState } from "react"

import { ProgramGeneratorForm, type FormValues } from "@/components/ai/program-generator-form"
import { ProgramPreview } from "@/components/ai/program-preview"
import { DailyWorkoutGeneratorForm, type DailyWorkoutFormValues } from "@/components/ai/daily-workout-generator-form"
import { DailyWorkoutPreview } from "@/components/ai/daily-workout-preview"
import { useLocale } from "@/components/providers/locale-provider"
import { GlassSegmented } from "@/components/ui/glass-segmented"
import type { AIDailyWorkout } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

type GenerateResult = {
  generationId: string
  program: {
    name: string
    description: string
    difficulty: string
    duration: number
    workoutsPerWeek: number
    workouts: Array<{
      name: string
      kind: string
      weekIndex: number
      scheduledDay: number
      duration: number
      exercises: Array<{
        variationId: string
        sets: number
        reps: number
        repsMin?: number
        rir?: number
        restTime?: number
        weight?: number
      }>
    }>
  }
}

type DailyGenerateResult = {
  generationId: string
  workout: AIDailyWorkout
}

const MODES = ["daily", "program"] as const

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function AIGenerateView() {
  const { mutateAsync: generateAIProgram, isPending: generateAIProgramPending } = useGenerateAIProgram()
  const { mutateAsync: acceptAIProgram, isPending: acceptAIProgramPending } = useAcceptAIProgram()
  const { mutateAsync: generateAIDailyWorkout, isPending: generateAIDailyWorkoutPending } = useGenerateAIDailyWorkout()
  const { mutateAsync: acceptAIDailyWorkout, isPending: acceptAIDailyWorkoutPending } = useAcceptAIDailyWorkout()
  const { locale } = useLocale()
  const isVi = locale === "vi"
  const router = useRouter()
  // Onboarding sends a trainee straight here with the goal they just picked.
  const searchParams = useSearchParams()
  const presetGoal = searchParams.get("goal")
  const [mode, setMode] = useState<"daily" | "program">(searchParams.get("mode") === "program" ? "program" : "daily")
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [dailyResult, setDailyResult] = useState<DailyGenerateResult | null>(null)
  const isGenerating = generateAIProgramPending || generateAIDailyWorkoutPending
  const isAccepting = acceptAIProgramPending || acceptAIDailyWorkoutPending
  const [error, setError] = useState<string | null>(null)
  const libraryQuery = useAIExerciseLibrary()
  const exerciseNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const exercise of libraryQuery.data ?? []) {
      for (const variation of exercise.variations) names.set(variation.id, `${exercise.name} (${variation.name})`)
    }
    return names
  }, [libraryQuery.data])

  const handleGenerate = async (values: FormValues) => {

    setError(null)
    setResult(null)

    try {
      const data = await generateAIProgram([{
        goal: values.goal,
        experienceLevel: values.experienceLevel,
        daysPerWeek: values.daysPerWeek,
        sessionDuration: values.sessionDuration,
        availableEquipment: values.availableEquipment,
        focusAreas: values.focusAreas.length > 0 ? values.focusAreas : undefined,
        injuries: values.injuries || undefined,
        durationWeeks: values.durationWeeks,
      }])
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : isVi ? "Không thể tạo chương trình. Vui lòng thử lại." : "Unable to generate a program. Please try again.")
    }
  }

  const handleAccept = async () => {
    if (!result) return

    setError(null)

    try {
      await acceptAIProgram([result.generationId])

      router.push("/workout")
    } catch (err) {
      setError(err instanceof Error ? err.message : isVi ? "Không thể lưu chương trình. Vui lòng thử lại." : "Unable to save the program. Please try again.")
    }
  }

  const handleGenerateDaily = async (values: DailyWorkoutFormValues) => {

    setError(null)
    setDailyResult(null)
    try {
      const data = await generateAIDailyWorkout([{
        ...values,
        date: formatLocalDate(new Date()),
        focusAreas: values.focusAreas.length ? values.focusAreas : undefined,
        injuries: values.injuries || undefined,
      }])
      setDailyResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : isVi ? "Không thể tạo buổi tập hôm nay. Vui lòng thử lại." : "Unable to generate today's workout. Please try again.")
    }
  }

  const handleAcceptDaily = async () => {
    if (!dailyResult) return

    setError(null)
    try {
      const accepted = await acceptAIDailyWorkout([dailyResult.generationId])

      router.push(`/workout/${accepted.workoutId}/start`)
    } catch (err) {
      setError(err instanceof Error ? err.message : isVi ? "Không thể lưu buổi tập hôm nay. Vui lòng thử lại." : "Unable to save today's workout. Please try again.")
    }
  }

  function changeMode(nextMode: "daily" | "program") {
    setMode(nextMode)
    setError(null)
    setResult(null)
    setDailyResult(null)
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-6 md:pt-6 md:pb-28">
      {/* One compact block: back, then the title beside its icon. The builder's
          promise lives in the subtitle; the form below is the page. */}
      <div className="mb-4">
        <Link href="/workout" className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" />
          {isVi ? "Quay lại" : "Back"}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Bot className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">AI Workout Builder</h1>
            <p className="truncate text-sm text-muted-foreground">
              {isVi ? "Buổi tập hôm nay hoặc chương trình nhiều tuần" : "Today's workout or a multi-week program"}
            </p>
          </div>
        </div>
      </div>

      <GlassSegmented
        role="tablist"
        aria-label="AI Workout Builder"
        activeIndex={MODES.indexOf(mode)}
        columns={{ count: MODES.length, gapPx: 4 }}
        lensClassName="rounded-xl"
        onSlide={(index) => changeMode(MODES[index])}
        className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1"
      >
        {(shownIndex) =>
          MODES.map((item, index) => (
            <button
              key={item}
              type="button"
              role="tab"
              data-segment
              aria-selected={mode === item}
              onClick={() => changeMode(item)}
              className={cn(
                "min-w-0 truncate rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                index === shownIndex ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item === "daily" ? (isVi ? "Buổi tập hôm nay" : "Today's workout") : isVi ? "Chương trình nhiều tuần" : "Multi-week program"}
            </button>
          ))
        }
      </GlassSegmented>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-text">
          {error}
        </div>
      )}

      {mode === "daily" && dailyResult ? (
        <DailyWorkoutPreview
          workout={dailyResult.workout}
          exerciseNames={exerciseNames}
          onAccept={() => void handleAcceptDaily()}
          onRegenerate={() => setDailyResult(null)}
          isAccepting={isAccepting}
        />
      ) : mode === "daily" ? (
        <DailyWorkoutGeneratorForm onSubmit={handleGenerateDaily} isLoading={isGenerating} />
      ) : result ? (
        <ProgramPreview
          program={result.program}
          exerciseNames={exerciseNames}
          onAccept={handleAccept}
          onRegenerate={() => setResult(null)}
          isAccepting={isAccepting}
        />
      ) : (
        <ProgramGeneratorForm
          initialValues={presetGoal ? { goal: presetGoal } : undefined}
          onSubmit={handleGenerate}
          isLoading={isGenerating}
        />
      )}
    </main>
  )
}

// useSearchParams needs a Suspense boundary above it during prerender.
export default function AIGeneratePage() {
  return (
    <Suspense fallback={null}>
      <AIGenerateView />
    </Suspense>
  )
}
