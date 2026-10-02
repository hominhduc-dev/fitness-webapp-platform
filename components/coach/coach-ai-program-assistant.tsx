"use client"

import { useMemo, useState } from "react"

import { ProgramGeneratorForm, type FormValues } from "@/components/ai/program-generator-form"
import { ProgramPreview } from "@/components/ai/program-preview"
import { useLocale } from "@/components/providers/locale-provider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useAIExerciseLibrary,
  useGenerateCoachTraineeAIProgram,
} from "@/lib/queries/ai"
import type { AIProgramGenerationResult } from "@/lib/fitness/api"
import type { CoachTrainee } from "@/lib/fitness/types"

/** A generated draft on its way into the program editor, to be edited before saving. */
type AIProgramDraft = {
  generationId: string
  goal: string
  program: AIProgramGenerationResult["program"]
  traineeId: string
}

type CoachAIProgramDialogProps = {
  /** The trainee picked in the editor, if any; otherwise the first on the roster. */
  initialTraineeId?: string | null
  onClose: () => void
  /** Accepting does not save: the draft goes to the editor for review. */
  onEditDraft: (draft: AIProgramDraft) => void
  open: boolean
  trainees: CoachTrainee[]
}

/**
 * Generates a personalized program draft for one trainee and previews it. The
 * coach then edits it in the program editor, where saving creates and assigns
 * it. Opened from the new-program editor.
 */
function CoachAIProgramDialog({ initialTraineeId, onClose, onEditDraft, open, trainees }: CoachAIProgramDialogProps) {
  const { locale, messages } = useLocale()
  const isVi = locale === "vi"
  const [traineeId, setTraineeId] = useState<string | null>(null)
  const [draft, setDraft] = useState<(AIProgramGenerationResult & { goal: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(undefined)
  const generateProgram = useGenerateCoachTraineeAIProgram()
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
  const busy = generateProgram.isPending

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
      setDraft({ ...result, goal: values.goal })
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

  const handleEditDraft = () => {
    if (!draft || !trainee) return
    onEditDraft({ generationId: draft.generationId, goal: draft.goal, program: draft.program, traineeId: trainee.id })
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
                acceptLabel={messages.coach.aiProgramEditDraft}
                exerciseNames={exerciseNames}
                isAccepting={false}
                onAccept={handleEditDraft}
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
export type { AIProgramDraft }
