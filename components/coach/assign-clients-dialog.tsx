"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { useCoachData } from "@/lib/queries/coach-data"
import { queryKeys } from "@/lib/queries/keys"
import { fetchCoachTrainees } from "@/lib/fitness/api"
import { useLocale } from "@/components/providers/locale-provider"
import { TraineeSelectList } from "@/components/coach/trainee-select-list"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAssignCoachProgram, useUnassignCoachProgram } from "@/lib/queries/coach"
import type { AssignedTrainee, CoachProgram, CoachTrainee } from "@/lib/fitness/types"

interface AssignClientsDialogProps {
  program: CoachProgram | null
  trainees: CoachTrainee[]
  onClose: () => void
  /** Called after the API calls succeed, with the new assigned-trainee list. */
  onAssigned: (programId: string, assignedTrainees: AssignedTrainee[]) => void
}

/**
 * Picks the one trainee a program belongs to. Pre-selects the current one, then
 * on save unassigns whoever it replaces before assigning the new trainee — the
 * server refuses a second assignee, so the order matters.
 */
export function AssignClientsDialog({ program, trainees: initialTrainees, onClose, onAssigned }: AssignClientsDialogProps) {
  const { data: trainees = initialTrainees } = useCoachData(queryKeys.coach.trainees(), fetchCoachTrainees, initialTrainees)
  const { messages } = useLocale()
  const assignProgram = useAssignCoachProgram()
  const unassignProgram = useUnassignCoachProgram()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialised, setInitialised] = useState<string | null>(null)

  // Seed selection from the program's current assignments when it opens,
  // and reset once it closes so reopening re-seeds from fresh assignments.
  if (program && initialised !== program.id) {
    setSelectedId(program.assignedTrainees?.[0]?.id ?? null)
    setInitialised(program.id)
    setError(null)
  } else if (!program && initialised !== null) {
    setInitialised(null)
  }

  const handleSave = async () => {
    if (!program) return
    const current = (program.assignedTrainees ?? []).map((t) => t.id)
    const toRemove = current.filter((id) => id !== selectedId)
    const toAdd = selectedId && !current.includes(selectedId) ? selectedId : null

    setSaving(true)
    setError(null)
    try {
      await Promise.all(toRemove.map((id) => unassignProgram.mutateAsync({ programId: program.id, traineeId: id })))
      if (toAdd) await assignProgram.mutateAsync({ programId: program.id, traineeId: toAdd })

      const nextAssigned: AssignedTrainee[] = trainees
        .filter((t) => t.id === selectedId)
        .map((t) => ({ assignedAt: new Date(), id: t.id, name: t.name, email: t.email, avatar: t.avatar, fitnessGoals: t.fitnessGoals }))

      onAssigned(program.id, nextAssigned)
      onClose()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : messages.coach.updateAssignmentsFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!program} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <p className="label-micro">{messages.coach.assignProgram}</p>
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">{program?.name}</DialogTitle>
          {program ? (
            <p className="font-mono text-xs tnum text-muted-foreground">
              {messages.coach.weeks(program.duration)} · {messages.coach.daysPerWeek(program.workoutsPerWeek)}
            </p>
          ) : null}
        </DialogHeader>

        {error ? (
          <div className="mx-5 mt-3 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{error}</div>
        ) : null}

        <TraineeSelectList
          className="px-5 py-3"
          listClassName="max-h-[44vh]"
          onSelect={setSelectedId}
          selectedId={selectedId}
          trainees={trainees}
        />

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <span className="text-xs text-muted-foreground">{messages.coach.oneTraineePerProgram}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {messages.common.cancel}
            </Button>
            <Button className="gap-1.5" onClick={() => void handleSave()} disabled={saving}>
              <Check className="h-3.5 w-3.5" />
              {saving ? messages.coach.saving : selectedId ? messages.coach.assign : messages.coach.clearAssignments}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
