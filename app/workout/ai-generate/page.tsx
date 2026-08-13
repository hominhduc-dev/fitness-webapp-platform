"use client"

import { ArrowLeft, Bot, ShieldCheck, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { ProgramGeneratorForm, type FormValues } from "@/components/ai/program-generator-form"
import { ProgramPreview } from "@/components/ai/program-preview"
import { DailyWorkoutGeneratorForm, type DailyWorkoutFormValues } from "@/components/ai/daily-workout-generator-form"
import { DailyWorkoutPreview } from "@/components/ai/daily-workout-preview"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { acceptAIDailyWorkout, acceptAIProgram, fetchExerciseLibrary, generateAIDailyWorkout, generateAIProgram, type AIDailyWorkout } from "@/lib/fitness/api"
import { markDashboardForRefresh } from "@/lib/fitness/dashboard-refresh"
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
  mappingRate: number
}

type DailyGenerateResult = {
  generationId: string
  workout: AIDailyWorkout
  mappingRate: number
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function AIGeneratePage() {
  const { session } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<"daily" | "program">("daily")
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [dailyResult, setDailyResult] = useState<DailyGenerateResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!session?.access_token) return
    fetchExerciseLibrary(session.access_token)
      .then((exercises) => {
        const nameMap = new Map<string, string>()
        for (const ex of exercises) {
          for (const v of ex.variations) {
            nameMap.set(v.id, `${ex.name} (${v.name})`)
          }
        }
        setExerciseNames(nameMap)
      })
      .catch(() => {})
  }, [session?.access_token])

  const handleGenerate = useCallback(async (values: FormValues) => {
    if (!session?.access_token) return
    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const data = await generateAIProgram(session.access_token, {
        goal: values.goal,
        experienceLevel: values.experienceLevel,
        daysPerWeek: values.daysPerWeek,
        sessionDuration: values.sessionDuration,
        availableEquipment: values.availableEquipment,
        focusAreas: values.focusAreas.length > 0 ? values.focusAreas : undefined,
        injuries: values.injuries || undefined,
        durationWeeks: values.durationWeeks,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo chương trình. Vui lòng thử lại.")
    } finally {
      setIsGenerating(false)
    }
  }, [session?.access_token])

  const handleAccept = useCallback(async () => {
    if (!session?.access_token || !result) return
    setIsAccepting(true)
    setError(null)

    try {
      await acceptAIProgram(session.access_token, result.generationId)
      markDashboardForRefresh()
      router.push("/workout")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu chương trình. Vui lòng thử lại.")
    } finally {
      setIsAccepting(false)
    }
  }, [session?.access_token, result, router])

  const handleGenerateDaily = useCallback(async (values: DailyWorkoutFormValues) => {
    if (!session?.access_token) return
    setIsGenerating(true)
    setError(null)
    setDailyResult(null)
    try {
      const data = await generateAIDailyWorkout(session.access_token, {
        ...values,
        date: formatLocalDate(new Date()),
        focusAreas: values.focusAreas.length ? values.focusAreas : undefined,
        injuries: values.injuries || undefined,
      })
      setDailyResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo buổi tập hôm nay. Vui lòng thử lại.")
    } finally {
      setIsGenerating(false)
    }
  }, [session?.access_token])

  const handleAcceptDaily = useCallback(async () => {
    if (!session?.access_token || !dailyResult) return
    setIsAccepting(true)
    setError(null)
    try {
      const accepted = await acceptAIDailyWorkout(session.access_token, dailyResult.generationId)
      markDashboardForRefresh()
      router.push(`/workout/${accepted.workoutId}/start`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu buổi tập hôm nay. Vui lòng thử lại.")
    } finally {
      setIsAccepting(false)
    }
  }, [dailyResult, router, session?.access_token])

  function changeMode(nextMode: "daily" | "program") {
    setMode(nextMode)
    setError(null)
    setResult(null)
    setDailyResult(null)
  }

  return (
    <main className="mx-auto max-w-[880px] px-4 pb-28 pt-5 sm:px-6 sm:py-8 md:px-10">
      <div className="mb-6 sm:mb-8">
        <Link href="/workout" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="size-4" />
          Quay lại
        </Link>
        <div className="glass-card flex items-start gap-3 rounded-[22px] border bg-gradient-to-br from-primary-soft/70 via-card to-card p-4 sm:p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">AI Workout Builder</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary"><Sparkles className="size-3" />Cá nhân hoá</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo một buổi tập hôm nay hoặc chương trình nhiều tuần
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-success" />Có kiểm tra thiết bị và giới hạn vận động</p>
          </div>
        </div>
      </div>

      <div className="auth-theme-tabs mb-6 grid grid-cols-2 rounded-full border bg-muted/50 p-1">
        <button type="button" onClick={() => changeMode("daily")} className={cn("rounded-full px-3 py-2.5 text-sm font-semibold transition-all", mode === "daily" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>Buổi tập hôm nay</button>
        <button type="button" onClick={() => changeMode("program")} className={cn("rounded-full px-3 py-2.5 text-sm font-semibold transition-all", mode === "program" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>Chương trình nhiều tuần</button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {mode === "daily" && dailyResult ? (
        <DailyWorkoutPreview
          workout={dailyResult.workout}
          exerciseNames={exerciseNames}
          mappingRate={dailyResult.mappingRate}
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
          mappingRate={result.mappingRate}
          onAccept={handleAccept}
          onRegenerate={() => setResult(null)}
          isAccepting={isAccepting}
        />
      ) : (
        <ProgramGeneratorForm
          onSubmit={handleGenerate}
          isLoading={isGenerating}
        />
      )}
    </main>
  )
}
