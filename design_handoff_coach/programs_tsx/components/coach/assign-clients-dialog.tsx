"use client"

import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { assignCoachProgram, unassignCoachProgram } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"
import type { AssignedTrainee, CoachProgram, CoachTrainee } from "@/lib/fitness/types"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
}

interface AssignClientsDialogProps {
  program: CoachProgram | null
  trainees: CoachTrainee[]
  onClose: () => void
  /** Called after the API calls succeed, with the new assigned-trainee list. */
  onAssigned: (programId: string, assignedTrainees: AssignedTrainee[]) => void
}

/**
 * Multi-select roster. Pre-checks already-assigned trainees, then on save
 * diffs the selection and calls assignCoachProgram / unassignCoachProgram
 * for the added / removed ids.
 */
export function AssignClientsDialog({ program, trainees, onClose, onAssigned }: AssignClientsDialogProps) {
  const { session } = useAuth()
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialised, setInitialised] = useState<string | null>(null)

  // Seed selection from the program's current assignments when it opens,
  // and reset once it closes so reopening re-seeds from fresh assignments.
  if (program && initialised !== program.id) {
    setSelected(new Set((program.assignedTrainees ?? []).map((t) => t.id)))
    setInitialised(program.id)
    setQuery("")
    setError(null)
  } else if (!program && initialised !== null) {
    setInitialised(null)
  }

  const visible = useMemo(
    () => trainees.filter((t) => !query || t.name.toLowerCase().includes(query.toLowerCase())),
    [trainees, query],
  )

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleSave = async () => {
    if (!program || !session?.access_token) return
    const token = session.access_token
    const current = new Set((program.assignedTrainees ?? []).map((t) => t.id))
    const toAdd = [...selected].filter((id) => !current.has(id))
    const toRemove = [...current].filter((id) => !selected.has(id))

    setSaving(true)
    setError(null)
    try {
      await Promise.all([
        ...toAdd.map((id) => assignCoachProgram(token, program.id, id)),
        ...toRemove.map((id) => unassignCoachProgram(token, program.id, id)),
      ])

      const nextAssigned: AssignedTrainee[] = trainees
        .filter((t) => selected.has(t.id))
        .map((t) => ({ id: t.id, name: t.name, email: t.email, avatar: t.avatar, fitnessGoals: t.fitnessGoals }))

      onAssigned(program.id, nextAssigned)
      onClose()
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Unable to update assignments.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!program} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <p className="label-micro">Assign program</p>
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">{program?.name}</DialogTitle>
          {program ? (
            <p className="font-mono text-xs tnum text-muted-foreground">
              {program.duration} weeks · {program.workoutsPerWeek} days/week
            </p>
          ) : null}
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients…"
              className="pl-9"
            />
          </div>
        </DialogHeader>

        {error ? (
          <div className="mx-5 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        ) : null}

        <div className="max-h-[44vh] overflow-y-auto py-1">
          {visible.map((trainee) => {
            const on = selected.has(trainee.id)
            return (
              <button
                key={trainee.id}
                type="button"
                onClick={() => toggle(trainee.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted",
                  on && "bg-muted",
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {getInitials(trainee.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm font-medium">{trainee.name}</span>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                </span>
              </button>
            )
          })}
          {visible.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No clients match.</div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <span className="font-mono text-xs tnum text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button className="gap-1.5" onClick={() => void handleSave()} disabled={saving}>
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving…" : selected.size === 0 ? "Clear assignments" : `Assign ${selected.size}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
