"use client"

import { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { AdminExerciseItem } from "@/lib/admin/types"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const MUSCLES = [
  "Chest", "Back", "Legs", "Shoulders", "Arms",
  "Core", "Glutes", "Calves", "Cardio", "Full Body",
]
const EQUIP = [
  "Barbell", "Dumbbell", "Kettlebell", "Cable", "Machine",
  "Bodyweight", "Resistance Band", "EZ Bar", "Smith Machine",
  "Pull-up Bar", "Bench", "Medicine Ball", "TRX", "Other",
]

type FormData = {
  id?: string
  name: string
  variationName: string
  muscleGroup: string
  equipment: string
}

/* ------------------------------------------------------------------ */
/* ExerciseFormModal                                                    */
/* ------------------------------------------------------------------ */

type ExerciseFormModalProps = {
  initial: AdminExerciseItem | null
  saving: boolean
  onClose: () => void
  onSave: (data: FormData) => void
}

function ExerciseFormModal({ initial, saving, onClose, onSave }: ExerciseFormModalProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [variationName, setVariation] = useState(initial?.variationName ?? "Default")
  const [muscleGroup, setMuscle] = useState(initial?.muscleGroup ?? MUSCLES[0])
  const [equipment, setEquipment] = useState(initial?.equipment ?? EQUIP[0])

  const canSave = name.trim().length > 0

  function handleSave() {
    if (!canSave) return
    onSave({ id: initial?.id, name: name.trim(), variationName, muscleGroup, equipment })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] max-w-[460px] flex-col gap-0 overflow-hidden rounded-[14px] p-0">
        <VisuallyHidden>
          <DialogTitle>{initial ? "Edit exercise" : "New exercise"}</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 pb-4 pt-5">
          <div>
            <p className="label-micro text-muted-foreground">{initial ? "Edit exercise" : "New exercise"}</p>
            <h2 className="mt-1 text-[19px] font-semibold tracking-tight text-foreground">
              {initial ? initial.name : "Add to library"}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <Label className="label-micro text-muted-foreground">Exercise name</Label>
            <Input
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bench Press"
              autoFocus
            />
          </div>

          {/* Variation */}
          <div>
            <Label className="label-micro text-muted-foreground">Variation</Label>
            <Input
              className="mt-1.5"
              value={variationName}
              onChange={(e) => setVariation(e.target.value)}
              placeholder="e.g. Wide Grip"
            />
          </div>

          {/* Muscle group chips */}
          <div>
            <Label className="label-micro text-muted-foreground">Muscle group</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MUSCLES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMuscle(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                    muscleGroup === m
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment chips */}
          <div>
            <Label className="label-micro text-muted-foreground">Equipment</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EQUIP.map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => setEquipment(eq)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors",
                    equipment === eq
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {initial ? "Save" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* GroupBlock                                                            */
/* ------------------------------------------------------------------ */

type GroupBlockProps = {
  group: string
  exercises: AdminExerciseItem[]
  open: boolean
  onToggle: () => void
  onEdit: (e: AdminExerciseItem) => void
  onDelete: (e: AdminExerciseItem) => void
  deletingId: string | null
}

function GroupBlock({ group, exercises, open, onToggle, onEdit, onDelete, deletingId }: GroupBlockProps) {
  const totalUses = exercises.reduce((a, e) => a + e.usageCount, 0)

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      {/* Group header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/40",
          open && "bg-muted/30",
        )}
      >
        {open
          ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        }
        <span className="flex-1 text-[15px] font-semibold text-foreground">{group}</span>
        <span className="font-mono text-[11px] text-muted-foreground tnum">
          {exercises.length} variation{exercises.length !== 1 ? "s" : ""}
        </span>
        <Badge variant="outline" className="font-mono text-[11px] tnum">
          {totalUses.toLocaleString()} uses
        </Badge>
      </button>

      {/* Exercise rows */}
      {open && (
        <div className="border-t border-border">
          {/* Column header */}
          <div
            className="grid items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-2"
            style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 80px 64px 56px" }}
          >
            <span className="label-micro text-muted-foreground">Exercise</span>
            <span className="label-micro text-muted-foreground">Variation</span>
            <span className="label-micro text-muted-foreground">Equipment</span>
            <span className="label-micro text-right text-muted-foreground">Uses</span>
            <span />
          </div>

          {exercises.map((e) => (
            <div
              key={e.id}
              className="grid items-center gap-2 border-b border-border/50 px-4 py-2.5 last:border-0 hover:bg-muted/20"
              style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 80px 64px 56px" }}
            >
              {/* Name + default badge */}
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[13px] font-medium text-foreground">{e.name}</span>
                {e.isDefault && (
                  <Badge variant="micro" className="bg-primary/10 text-primary border-primary/20 shrink-0">
                    Default
                  </Badge>
                )}
              </div>

              {/* Variation name */}
              <span className="truncate text-[12px] text-muted-foreground">{e.variationName}</span>

              {/* Equipment */}
              <span className="text-[12px] text-muted-foreground">{e.equipment ?? "—"}</span>

              {/* Usage count */}
              <span className="text-right font-mono text-[12px] text-muted-foreground tnum">
                {e.usageCount}
              </span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-0.5">
                <button
                  type="button"
                  title="Edit"
                  onClick={() => onEdit(e)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={e.usageCount > 0 ? "Cannot delete — in use" : "Delete"}
                  disabled={e.usageCount > 0 || deletingId === e.id}
                  onClick={() => onDelete(e)}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    e.usageCount > 0 || deletingId === e.id
                      ? "cursor-not-allowed text-muted-foreground/30"
                      : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                  )}
                >
                  {deletingId === e.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AdminExercisesPanel (main export)                                    */
/* ------------------------------------------------------------------ */

export type ExerciseSaveData = {
  id?: string
  name: string
  variationName: string
  muscleGroup: string
  equipment: string
}

type Props = {
  exercises: AdminExerciseItem[]
  actionKey: string | null
  locale: "en" | "vi"
  onSave: (data: ExerciseSaveData) => Promise<void>
  onDelete: (exercise: AdminExerciseItem) => Promise<void>
  onImport: () => void
  onDownloadTemplate: () => void
}

export function AdminExercisesPanel({
  exercises,
  actionKey,
  locale,
  onSave,
  onDelete,
  onImport,
  onDownloadTemplate,
}: Props) {
  const [q, setQ] = useState("")
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [modal, setModal] = useState<"new" | AdminExerciseItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* Derived: filter + group */
  const filtered = useMemo(() => {
    if (!q.trim()) return exercises
    const lq = q.toLowerCase()
    return exercises.filter((e) =>
      [e.name, e.variationName, e.muscleGroup, e.equipment].some((v) => v?.toLowerCase().includes(lq)),
    )
  }, [exercises, q])

  const grouped = useMemo(() => {
    const map: Record<string, AdminExerciseItem[]> = {}
    filtered.forEach((e) => {
      const g = e.muscleGroup || "Other"
      ;(map[g] ??= []).push(e)
    })
    return Object.keys(map)
      .sort()
      .map((group) => ({ group, items: map[group] }))
  }, [filtered])

  /* Auto-expand when searching */
  const forceOpen = q.trim().length > 0

  function toggle(g: string) {
    setOpenGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  async function handleSave(data: FormData) {
    await onSave(data)
    setModal(null)
  }

  async function handleDelete(e: AdminExerciseItem) {
    if (!confirm(`Delete "${e.name} · ${e.variationName}"?`)) return
    setDeletingId(e.id)
    try {
      await onDelete(e)
    } finally {
      setDeletingId(null)
    }
  }

  const isSaving =
    actionKey === "exercise-create" ||
    (typeof modal === "object" && modal !== null && actionKey === `exercise-update-${modal.id}`)

  return (
    <div className="space-y-5">
      {/* Actions toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onDownloadTemplate}
          disabled={actionKey === "exercise-template-download"}
        >
          {actionKey === "exercise-template-download"
            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            : <Download className="mr-1.5 h-4 w-4" />
          }
          Template
        </Button>
        <Button variant="outline" onClick={onImport}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Import Excel
        </Button>
        <Button onClick={() => setModal("new")}>
          <Plus className="mr-1.5 h-4 w-4" />
          New exercise
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-[360px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises…"
          className="pl-9"
        />
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-2.5">
        {grouped.map(({ group, items }) => (
          <GroupBlock
            key={group}
            group={group}
            exercises={items}
            open={forceOpen || openGroups.includes(group)}
            onToggle={() => toggle(group)}
            onEdit={(e) => setModal(e)}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        ))}
        {grouped.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No exercises match.
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <ExerciseFormModal
          initial={modal === "new" ? null : modal}
          saving={isSaving}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
