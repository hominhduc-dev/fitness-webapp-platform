"use client"

import { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Check,
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
import { matchesExerciseSearch, sortByExerciseRelevance, sortGroupsByExerciseRelevance } from "@/lib/exercise-search"
import { cn } from "@/lib/utils"
import type { AdminExerciseImportRequest, AdminExerciseItem } from "@/lib/admin/types"
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

function getExercisePanelCopy(locale: "en" | "vi") {
  return {
    addToLibrary: locale === "en" ? "Add to library" : "Thêm vào thư viện",
    approve: locale === "en" ? "Approve" : "Duyệt",
    cancel: locale === "en" ? "Cancel" : "Hủy",
    cannotDeleteInUse: locale === "en" ? "Cannot delete - in use" : "Không thể xóa - đang được dùng",
    cannotManageShared: locale === "en" ? "Cannot manage shared exercise" : "Không thể sửa bài tập dùng chung",
    coachExerciseImports: locale === "en" ? "Coach exercise imports" : "Import bài tập từ coach",
    create: locale === "en" ? "Create" : "Tạo",
    default: locale === "en" ? "Default" : "Mặc định",
    delete: locale === "en" ? "Delete" : "Xóa",
    deleteConfirm: (name: string, variation: string) =>
      locale === "en" ? `Delete "${name} · ${variation}"?` : `Xóa "${name} · ${variation}"?`,
    downloadTemplate: locale === "en" ? "Download template" : "Tải file mẫu",
    editExercise: locale === "en" ? "Edit exercise" : "Sửa bài tập",
    equipment: locale === "en" ? "Equipment" : "Thiết bị",
    exercise: locale === "en" ? "Exercise" : "Bài tập",
    exerciseName: locale === "en" ? "Exercise name" : "Tên bài tập",
    importExcel: locale === "en" ? "Import Excel" : "Import Excel",
    newExercise: locale === "en" ? "New exercise" : "Bài tập mới",
    noMatches: locale === "en" ? "No exercises match." : "Không có bài tập nào khớp.",
    pending: locale === "en" ? "pending" : "chờ duyệt",
    pendingReview: locale === "en" ? "Pending review" : "Chờ duyệt",
    reject: locale === "en" ? "Reject" : "Từ chối",
    rows: locale === "en" ? "rows" : "dòng",
    save: locale === "en" ? "Save" : "Lưu",
    searchExercises: locale === "en" ? "Search exercises..." : "Tìm bài tập...",
    submittedBy: locale === "en" ? "Submitted by" : "Gửi bởi",
    untitledImport: locale === "en" ? "Untitled import" : "File import chưa đặt tên",
    usageCount: (count: number) =>
      locale === "en" ? `${count.toLocaleString()} uses` : `${count.toLocaleString()} lượt dùng`,
    uses: locale === "en" ? "Uses" : "Lượt dùng",
    variation: locale === "en" ? "Variation" : "Variation",
    variationCount: (count: number) => (locale === "en" ? `${count} variation${count === 1 ? "" : "s"}` : `${count} variation`),
  }
}

/* ------------------------------------------------------------------ */
/* ExerciseFormModal                                                    */
/* ------------------------------------------------------------------ */

type ExerciseFormModalProps = {
  initial: AdminExerciseItem | null
  locale: "en" | "vi"
  saving: boolean
  onClose: () => void
  onSave: (data: FormData) => void
}

function ExerciseFormModal({ initial, locale, saving, onClose, onSave }: ExerciseFormModalProps) {
  const copy = getExercisePanelCopy(locale)
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
          <DialogTitle>{initial ? copy.editExercise : copy.newExercise}</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 pb-4 pt-5">
          <div>
            <p className="label-micro text-muted-foreground">{initial ? copy.editExercise : copy.newExercise}</p>
            <h2 className="mt-1 text-[19px] font-semibold tracking-tight text-foreground">
              {initial ? initial.name : copy.addToLibrary}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <Label className="label-micro text-muted-foreground">{copy.exerciseName}</Label>
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
            <Label className="label-micro text-muted-foreground">{copy.variation}</Label>
            <Input
              className="mt-1.5"
              value={variationName}
              onChange={(e) => setVariation(e.target.value)}
              placeholder="e.g. Wide Grip"
            />
          </div>

          {/* Muscle group chips */}
          <div>
            <Label className="label-micro text-muted-foreground">{locale === "en" ? "Muscle group" : "Nhóm cơ"}</Label>
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
            <Label className="label-micro text-muted-foreground">{copy.equipment}</Label>
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
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {initial ? copy.save : copy.create}
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
  locale: "en" | "vi"
}

function GroupBlock({ group, exercises, open, onToggle, onEdit, onDelete, deletingId, locale }: GroupBlockProps) {
  const copy = getExercisePanelCopy(locale)
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
          {copy.variationCount(exercises.length)}
        </span>
        <Badge variant="outline" className="font-mono text-[11px] tnum">
          {copy.usageCount(totalUses)}
        </Badge>
      </button>

      {/* Exercise rows */}
      {open && (
        <div className="border-t border-border">
          {/* Column header */}
          <div className="grid grid-cols-[minmax(0,1.4fr)_56px_56px] items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_80px_64px_56px]">
            <span className="label-micro text-muted-foreground">{copy.exercise}</span>
            <span className="label-micro hidden text-muted-foreground sm:block">{copy.variation}</span>
            <span className="label-micro hidden text-muted-foreground sm:block">{copy.equipment}</span>
            <span className="label-micro text-right text-muted-foreground">{copy.uses}</span>
            <span />
          </div>

          {exercises.map((e) => {
            const canManage = (e as AdminExerciseItem & { canManage?: boolean }).canManage ?? true
            return (
            <div
              key={e.id}
              className="grid grid-cols-[minmax(0,1.4fr)_56px_56px] items-center gap-2 border-b border-border/50 px-4 py-2.5 last:border-0 hover:bg-muted/20 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_80px_64px_56px]"
            >
              {/* Name + default badge (+ variation/equipment inline on mobile) */}
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-foreground">{e.name}</span>
                  {e.isDefault && (
                    <Badge variant="micro" className="bg-primary-soft text-primary border-primary/20 shrink-0">
                      {copy.default}
                    </Badge>
                  )}
                </div>
                {/* Mobile-only: show variation + equipment under the name */}
                <span className="truncate text-[11px] text-muted-foreground sm:hidden">
                  {e.variationName}
                  {e.equipment ? ` · ${e.equipment}` : ""}
                </span>
              </div>

              {/* Variation name (desktop column) */}
              <span className="hidden truncate text-[12px] text-muted-foreground sm:block">{e.variationName}</span>

              {/* Equipment (desktop column) */}
              <span className="hidden text-[12px] text-muted-foreground sm:block">{e.equipment ?? "—"}</span>

              {/* Usage count */}
              <span className="text-right font-mono text-[12px] text-muted-foreground tnum">
                {e.usageCount}
              </span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-0.5">
                <button
                  type="button"
                  title="Edit"
                  disabled={!canManage}
                  onClick={() => onEdit(e)}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    canManage
                      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                      : "cursor-not-allowed text-muted-foreground/30",
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title={!canManage ? copy.cannotManageShared : e.usageCount > 0 ? copy.cannotDeleteInUse : copy.delete}
                  disabled={!canManage || e.usageCount > 0 || deletingId === e.id}
                  onClick={() => onDelete(e)}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    !canManage || e.usageCount > 0 || deletingId === e.id
                      ? "cursor-not-allowed text-muted-foreground/30"
                      : "text-muted-foreground hover:bg-destructive-soft hover:text-destructive",
                  )}
                >
                  {deletingId === e.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            </div>
            )
          })}
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
  importRequests?: AdminExerciseImportRequest[]
  locale: "en" | "vi"
  onSave: (data: ExerciseSaveData) => Promise<void>
  onDelete: (exercise: AdminExerciseItem) => Promise<void>
  onImport: () => void
  onDownloadTemplate: () => void
  onReviewImportRequest?: (requestId: string, status: "approved" | "rejected") => Promise<void>
}

export function AdminExercisesPanel({
  exercises,
  actionKey,
  importRequests = [],
  locale,
  onSave,
  onDelete,
  onImport,
  onDownloadTemplate,
  onReviewImportRequest,
}: Props) {
  const copy = getExercisePanelCopy(locale)
  const [q, setQ] = useState("")
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [modal, setModal] = useState<"new" | AdminExerciseItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* Derived: filter + group */
  const filtered = useMemo(
    () => exercises.filter((e) => matchesExerciseSearch([e.name, e.variationName, e.muscleGroup, e.equipment], q)),
    [exercises, q],
  )

  const grouped = useMemo(() => {
    const map: Record<string, AdminExerciseItem[]> = {}
    filtered.forEach((e) => {
      const g = e.muscleGroup || "Other"
      ;(map[g] ??= []).push(e)
    })
    const groups = Object.keys(map).map((group) => ({ group, items: sortByExerciseRelevance(map[group], q, (e) => e.name) }))
    return sortGroupsByExerciseRelevance(groups, q, (g) => g.group, (g) => g.items)
  }, [filtered, q])

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
    if (!confirm(copy.deleteConfirm(e.name, e.variationName))) return
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
      {importRequests.length > 0 ? (
        <div className="rounded-[10px] border border-border bg-card">
          <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label-micro text-muted-foreground">{copy.pendingReview}</p>
              <h3 className="text-sm font-semibold text-foreground">
                {copy.coachExerciseImports}
              </h3>
            </div>
            <Badge variant="outline" className="w-fit font-mono text-[11px]">
              {importRequests.length} {copy.pending}
            </Badge>
          </div>
          <div className="divide-y divide-border">
            {importRequests.map((request) => (
              <div key={request.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {request.fileName ?? copy.untitledImport}
                    </p>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {request.rowCount} {copy.rows}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.submittedBy} {request.submittedBy.name} ·{" "}
                    {request.createdAt.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-transparent"
                    disabled={!onReviewImportRequest || actionKey === `exercise-import-review-${request.id}`}
                    onClick={() => void onReviewImportRequest?.(request.id, "rejected")}
                  >
                    <X className="h-4 w-4" />
                    {copy.reject}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!onReviewImportRequest || actionKey === `exercise-import-review-${request.id}`}
                    onClick={() => void onReviewImportRequest?.(request.id, "approved")}
                  >
                    {actionKey === `exercise-import-review-${request.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {copy.approve}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
          {copy.downloadTemplate}
        </Button>
        <Button variant="outline" onClick={onImport}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          {copy.importExcel}
        </Button>
        <Button onClick={() => setModal("new")}>
          <Plus className="mr-1.5 h-4 w-4" />
          {copy.newExercise}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-[360px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={copy.searchExercises}
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
            locale={locale}
          />
        ))}
        {grouped.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            {copy.noMatches}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <ExerciseFormModal
          initial={modal === "new" ? null : modal}
          locale={locale}
          saving={isSaving}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
