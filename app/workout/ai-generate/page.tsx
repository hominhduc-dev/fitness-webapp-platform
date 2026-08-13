"use client"

import { ArrowLeft, Bot, ShieldCheck, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { ProgramGeneratorForm, type FormValues } from "@/components/ai/program-generator-form"
import { ProgramPreview } from "@/components/ai/program-preview"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { acceptAIProgram, fetchExerciseLibrary, generateAIProgram } from "@/lib/fitness/api"
import { markDashboardForRefresh } from "@/lib/fitness/dashboard-refresh"

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

export default function AIGeneratePage() {
  const { session } = useAuth()
  const router = useRouter()
  const [result, setResult] = useState<GenerateResult | null>(null)
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
              <h1 className="text-xl font-bold sm:text-2xl">AI Tạo Chương Trình</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary"><Sparkles className="size-3" />Cá nhân hoá</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Cá nhân hoá lịch tập dựa trên mục tiêu và trình độ của bạn
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-success" />Có kiểm tra thiết bị và giới hạn vận động</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result ? (
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
