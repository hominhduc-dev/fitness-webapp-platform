"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy, Dumbbell, Edit3, MoreHorizontal, Plus, Search, Trash2, UserPlus } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  assignCoachProgram,
  createCoachProgram,
  deleteCoachProgram,
  unassignCoachProgram,
} from "@/lib/fitness/api"
import type { CoachProgram, CoachTrainee } from "@/lib/fitness/types"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
}

/* ------------------------------------------------------------------ */
/* AssignClientsModal                                                   */
/* ------------------------------------------------------------------ */

type AssignClientsModalProps = {
  program: CoachProgram
  trainees: CoachTrainee[]
  onClose: () => void
  onSaved: (program: CoachProgram) => void
}

function AssignClientsModal({ program, trainees, onClose, onSaved }: AssignClientsModalProps) {
  const { session } = useAuth()
  const preSelected = new Set(program.assignedTrainees.map((t) => t.id))
  const [selected, setSelected] = useState<Set<string>>(preSelected)
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)

  const visible = trainees.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()))
  const selectedCount = selected.size

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleSave = async () => {
    if (!session?.access_token) return
    setSaving(true)
    try {
      const token = session.access_token
      const toAdd = trainees.filter((t) => selected.has(t.id) && !preSelected.has(t.id))
      const toRemove = trainees.filter((t) => !selected.has(t.id) && preSelected.has(t.id))

      await Promise.all([
        ...toAdd.map((t) => assignCoachProgram(token, program.id, t.id)),
        ...toRemove.map((t) => unassignCoachProgram(token, program.id, t.id)),
      ])

      const newAssigned = trainees.filter((t) => selected.has(t.id))
      onSaved({
        ...program,
        assignedTrainees: newAssigned.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          avatar: t.avatar,
          fitnessGoals: t.fitnessGoals,
        })),
      })
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[88vh] max-w-[480px] flex-col gap-0 overflow-hidden rounded-[14px] p-0">
        <VisuallyHidden><DialogTitle>Assign program</DialogTitle></VisuallyHidden>
        {/* Header */}
        <div className="border-b border-border px-6 pb-4 pt-5">
          <p className="label-micro text-muted-foreground">Assign program</p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{program.name}</h2>
          <p className="label-micro mt-1 text-muted-foreground tnum">
            {program.duration} weeks · {program.workoutsPerWeek} days/week
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-[11px] h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients…"
              className="pl-8"
              autoFocus
            />
          </div>
        </div>

        {/* Trainee list */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No clients match.</p>
          ) : (
            visible.map((t) => {
              const on = selected.has(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/50"
                  style={{ background: on ? "color-mix(in srgb, var(--muted) 50%, transparent)" : undefined }}
                >
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={t.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="bg-muted text-xs font-medium">{getInitials(t.name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm font-medium">{t.name}</span>
                  <span
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md transition-all"
                    style={{
                      border: `1.5px solid ${on ? "var(--primary)" : "var(--border)"}`,
                      background: on ? "var(--primary)" : "transparent",
                    }}
                  >
                    {on && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="font-mono text-xs text-muted-foreground tnum">{selectedCount} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {selectedCount === 0 ? "Clear assignments" : `Assign ${selectedCount}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* ProgramCard                                                          */
/* ------------------------------------------------------------------ */

type ProgramCardProps = {
  program: CoachProgram
  onEdit: () => void
  onAssign: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function ProgramCard({ program, onEdit, onAssign, onDuplicate, onDelete }: ProgramCardProps) {
  return (
    <div className="group flex flex-col gap-3.5 rounded-[10px] border border-border bg-card p-5 transition-colors hover:border-primary/20">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">{program.name}</h3>
          <p className="label-micro mt-1 text-muted-foreground tnum">
            {program.duration} weeks · {program.workoutsPerWeek} days/week
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Program actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Edit3 className="mr-2 h-3.5 w-3.5" />
              Edit program
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAssign}>
              <UserPlus className="mr-2 h-3.5 w-3.5" />
              Assign
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {program.description && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{program.description}</p>
      )}

      {/* Assigned strip */}
      <div className="flex items-center gap-2.5 rounded-md bg-muted p-2.5">
        {program.assignedTrainees.length > 0 ? (
          <>
            <div className="flex">
              {program.assignedTrainees.slice(0, 4).map((t, i) => (
                <Avatar key={t.id} className="-ml-2 h-6 w-6 border-2 border-card first:ml-0">
                  <AvatarImage src={t.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                    {getInitials(t.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="font-mono text-[11px] text-muted-foreground tnum">
              {program.assignedTrainees.length} active client{program.assignedTrainees.length === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className="label-micro text-muted-foreground">Not assigned yet</span>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-auto flex gap-2">
        <Button className="flex-1" onClick={onAssign}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Assign
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      {/* Edited date */}
      <p className="label-micro text-muted-foreground">
        Created {program.createdAt.toLocaleDateString()}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ProgramsListClient (main export)                                     */
/* ------------------------------------------------------------------ */

type Props = {
  initialPrograms: CoachProgram[]
  trainees: CoachTrainee[]
}

export function ProgramsListClient({ initialPrograms, trainees }: Props) {
  const { session } = useAuth()
  const [programs, setPrograms] = useState(initialPrograms)
  const [assignTarget, setAssignTarget] = useState<CoachProgram | null>(null)

  const totalClients = programs.reduce((a, p) => a + p.assignedTrainees.length, 0)
  const unassigned = programs.filter((p) => p.assignedTrainees.length === 0).length

  const handleDuplicate = async (p: CoachProgram) => {
    if (!session?.access_token) return
    try {
      const copy = await createCoachProgram(session.access_token, {
        name: p.name + " (copy)",
        description: p.description ?? "",
        difficulty: p.difficulty,
        duration: p.duration,
        workouts: p.workouts.map((w) => ({
          name: w.name,
          scheduledDay: w.scheduledDay,
          duration: w.duration,
          exercises: w.exercises.map((e) => ({
            variationId: e.variation.id,
            sets: e.sets.length || 3,
            reps: e.sets[0]?.targetReps ?? 8,
            repsMin: e.sets[0]?.targetRepsMin,
            weight: e.sets[0]?.weight,
          })),
        })),
      })
      const idx = programs.findIndex((x) => x.id === p.id)
      setPrograms((prev) => {
        const next = [...prev]
        next.splice(idx + 1, 0, copy)
        return next
      })
    } catch {
      // silently fail — duplicate is a convenience action
    }
  }

  const handleDelete = async (p: CoachProgram) => {
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return
    if (!session?.access_token) return
    try {
      await deleteCoachProgram(session.access_token, p.id)
      setPrograms((prev) => prev.filter((x) => x.id !== p.id))
    } catch {
      alert("Failed to delete program. Please try again.")
    }
  }

  const handleAssignSaved = (updated: CoachProgram) => {
    setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  if (programs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-muted">
          <Dumbbell className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">No programs yet</h3>
        <p className="mb-5 max-w-xs text-sm text-muted-foreground">
          Create your first program to start assigning workouts to trainees.
        </p>
        <Link href="/coach/programs/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Program
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-micro text-muted-foreground">Programs</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            {programs.length} authored.
          </h1>
          <p className="mt-1.5 font-mono text-sm text-muted-foreground tnum">
            {totalClients} clients training on a program · {unassigned} unassigned
          </p>
        </div>
        <Link href="/coach/programs/new">
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            New program
          </Button>
        </Link>
      </div>

      {/* Grid */}
      <div
        className="grid gap-[14px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
      >
        {programs.map((p) => (
          <ProgramCard
            key={p.id}
            program={p}
            onEdit={() => (window.location.href = `/coach/programs/${p.id}`)}
            onAssign={() => setAssignTarget(p)}
            onDuplicate={() => handleDuplicate(p)}
            onDelete={() => handleDelete(p)}
          />
        ))}
      </div>

      {assignTarget && (
        <AssignClientsModal
          program={assignTarget}
          trainees={trainees}
          onClose={() => setAssignTarget(null)}
          onSaved={handleAssignSaved}
        />
      )}
    </div>
  )
}
