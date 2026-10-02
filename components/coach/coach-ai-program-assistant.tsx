"use client"

import { useMemo, useState } from "react"

import { ProgramGeneratorForm, type FormValues } from "@/components/ai/program-generator-form"
import { ProgramPreview } from "@/components/ai/program-preview"
import { useLocale } from "@/components/providers/locale-provider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useAcceptCoachTraineeAIProgram,
  useAIExerciseLibrary,
  useGenerateCoachTraineeAIProgram,
} from "@/lib/queries/ai"
import type { AIProgramGenerationResult } from "@/lib/fitness/api"
import type { CoachTrainee } from "@/lib/fitness/types"

type CoachAIProgramDialogProps = {
  /** The trainee picked in the editor, if any; otherwise the first on the roster. */
  initialTraineeId?: string | null
  onAccepted?: () => void
  onClose: () => void
  open: boolean
  trainees: CoachTrainee[]
}

/**
 * Generates a personalized program draft for one trainee, previews it, and on
 * accept saves it and assigns it to them. Opened from the new-program editor.
 */
function CoachAIProgramDialog({ initialTraineeId, onAccepted, onClose, open, trainees }: CoachAIProgramDialogProps) {
  const { locale, messages } = useLocale()
  const isVi = locale === "vi"
  const [traineeId, setTraineeId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AIProgramGenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(undefined)
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

  // Start fresh each time it opens, on the trainee the editor handed over.
  const seed = open ? (initialTraineeId ?? null) : undefined
  if (seed !== openedFor) {
    setOpenedFor(seed)
    if (seed !== undefined) {
      setTraineeId(seed && trainees.some((trainee) => trainee.id === seed) ? seed : (trainees[0]?.id ?? null))
      setDraft(null)
      setError(null)
    }
  }

  const trainee = trainees.find((candidate) => candidate.id === traineeId) ?? null
  const busy = generateProgram.isPending || acceptProgram.isPending

  const handleGenerate = async (values: FormValues) => {
    if (!trainee) return
    setError(null)
    setDraft(null)

    try {
      const result = await generateProgram.mutateAsync([
        trainee.id,
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
    if (!draft || !trainee) return

    setError(null)
    try {
      await acceptProgram.mutateAsync([trainee.id, draft.generationId])
      onAccepted?.()
      onClose()
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
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{messages.coach.aiProgramTitle}</DialogTitle>
          <DialogDescription>{messages.coach.aiProgramDescription}</DialogDescription>
        </DialogHeader>

        {trainees.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {messages.coach.aiProgramNoClients}
          </p>
        ) : (
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ai-program-trainee">{messages.coach.assignClients}</Label>
              <Select
                value={traineeId ?? ""}
                disabled={busy}
                onValueChange={(value) => {
                  setTraineeId(value)
                  setDraft(null)
                  setError(null)
                }}
              >
                <SelectTrigger id="ai-program-trainee" className="w-full sm:w-72">
                  <SelectValue placeholder={messages.coach.aiProgramSelectClient} />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {trainees.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? (
              <div className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{error}</div>
            ) : null}

            {draft ? (
              <ProgramPreview
                exerciseNames={exerciseNames}
                isAccepting={acceptProgram.isPending}
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
        )}
      </DialogContent>
    </Dialog>
  )
}

export { CoachAIProgramDialog }
