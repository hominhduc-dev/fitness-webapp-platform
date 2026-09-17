"use client"

import { Bot, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"

import { ProgramGeneratorForm, type FormValues } from "@/components/ai/program-generator-form"
import { ProgramPreview } from "@/components/ai/program-preview"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  useAcceptCoachTraineeAIProgram,
  useAIExerciseLibrary,
  useGenerateCoachTraineeAIProgram,
} from "@/lib/queries/ai"
import type { AIProgramGenerationResult } from "@/lib/fitness/api"

type CoachAIProgramAssistantProps = {
  onAccepted?: () => void
  traineeId: string
  traineeName: string
}

function CoachAIProgramAssistant({ onAccepted, traineeId, traineeName }: CoachAIProgramAssistantProps) {
  const { locale } = useLocale()
  const isVi = locale === "vi"
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AIProgramGenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generateProgram = useGenerateCoachTraineeAIProgram()
  const acceptProgram = useAcceptCoachTraineeAIProgram()
  const libraryQuery = useAIExerciseLibrary()
  const exerciseNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const exercise of libraryQuery.data ?? []) {
      for (const variation of exercise.variations) {
        names.set(variation.id, `${exercise.name} (${variation.name})`)
      }
    }
    return names
  }, [libraryQuery.data])

  const handleGenerate = async (values: FormValues) => {
    setError(null)
    setDraft(null)

    try {
      const result = await generateProgram.mutateAsync([
        traineeId,
        {
          availableEquipment: values.availableEquipment,
          daysPerWeek: values.daysPerWeek,
          durationWeeks: values.durationWeeks,
          experienceLevel: values.experienceLevel,
          focusAreas: values.focusAreas.length > 0 ? values.focusAreas : undefined,
          goal: values.goal,
          injuries: values.injuries || undefined,
          sessionDuration: values.sessionDuration,
        },
      ])
      setDraft(result)
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : isVi
            ? "Không thể tạo program AI cho trainee."
            : "Unable to generate an AI program for this trainee.",
      )
    }
  }

  const handleAccept = async () => {
    if (!draft) return

    setError(null)
    try {
      await acceptProgram.mutateAsync([traineeId, draft.generationId])
      setDraft(null)
      setOpen(false)
      onAccepted?.()
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : isVi
            ? "Không thể lưu và gán program AI."
            : "Unable to save and assign the AI program.",
      )
    }
  }

  return (
    <section className="rounded-lg border border-primary/20 bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                {isVi ? "AI Program Assistant" : "AI Program Assistant"}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-micro font-semibold uppercase tracking-[0.08em] text-primary">
                <Sparkles className="h-3 w-3" />
                {isVi ? "Coach" : "Coach"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isVi
                ? `Tạo draft program cá nhân hoá cho ${traineeName}, kiểm tra rồi lưu & gán trực tiếp.`
                : `Create a personalized draft for ${traineeName}, review it, then save and assign it.`}
            </p>
          </div>
        </div>
        <Button type="button" className="gap-2 sm:w-auto" onClick={() => setOpen((current) => !current)}>
          <Sparkles className="h-4 w-4" />
          {open ? (isVi ? "Ẩn assistant" : "Hide assistant") : isVi ? "Tạo bằng AI" : "Generate with AI"}
        </Button>
      </div>

      {open ? (
        <div className="border-t border-border p-4">
          {error ? (
            <div className="mb-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">
              {error}
            </div>
          ) : null}

          {draft ? (
            <ProgramPreview
              exerciseNames={exerciseNames}
              isAccepting={acceptProgram.isPending}
              mappingRate={draft.mappingRate}
              onAccept={() => void handleAccept()}
              onRegenerate={() => setDraft(null)}
              program={draft.program}
            />
          ) : (
            <ProgramGeneratorForm
              isLoading={generateProgram.isPending}
              onSubmit={(values) => void handleGenerate(values)}
            />
          )}
        </div>
      ) : null}
    </section>
  )
}

export { CoachAIProgramAssistant }
