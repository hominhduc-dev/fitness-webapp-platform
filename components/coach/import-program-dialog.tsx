"use client"

import { AlertCircle, AlertTriangle, ArrowLeft, Check, CheckCircle2, FileDown, Loader2, Trash2, UploadCloud, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ImportedProgramDraft } from "@/components/coach/program-excel"
import { createCoachProgram } from "@/lib/fitness/api"
import type {
  CoachProgram,
  CoachTrainee,
  CreateCoachProgramInput,
  ExerciseVariationOption,
} from "@/lib/fitness/types"
import { parseRepTargetText } from "@/lib/workout-reps"
import { cn } from "@/lib/utils"

type ImportProgramDialogProps = {
  exerciseOptions: ExerciseVariationOption[]
  onClose: () => void
  onImported: (program: CoachProgram) => void
  open: boolean
  token?: string
  trainees: CoachTrainee[]
}

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
}

type Step = "upload" | "review" | "done"
type Difficulty = CreateCoachProgramInput["difficulty"]

const STEPS: Array<{ label: string; value: Step }> = [
  { label: "Upload", value: "upload" },
  { label: "Review", value: "review" },
  { label: "Done", value: "done" },
]

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"]

// ─── Editable workout types ─────────────────────────────────────────────────

type EditableExercise = {
  variationId: string
  sets: string
  reps: string   // "8-12" or "10"
  weight: string
  rir: string
}

type EditableWorkout = {
  name: string
  scheduledDay?: number
  exercises: EditableExercise[]
}

function workoutToEditable(workout: CreateCoachProgramInput["workouts"][number]): EditableWorkout {
  return {
    name: workout.name,
    scheduledDay: workout.scheduledDay,
    exercises: workout.exercises.map((ex) => ({
      variationId: ex.variationId,
      sets: String(ex.sets),
      reps: ex.repsMin != null && ex.repsMin !== ex.reps
        ? `${ex.repsMin}-${ex.reps}`
        : String(ex.reps),
      weight: ex.weight != null ? String(ex.weight) : "",
      rir: ex.rir != null ? String(ex.rir) : "",
    })),
  }
}

function editableToPayloadWorkout(
  editable: EditableWorkout,
): CreateCoachProgramInput["workouts"][number] {
  return {
    name: editable.name,
    scheduledDay: editable.scheduledDay,
    exercises: editable.exercises
      .filter((ex) => ex.variationId)
      .map((ex) => {
        const repTarget = parseRepTargetText(ex.reps) ?? { reps: Math.max(1, Number(ex.reps) || 1) }
        const parsedWeight = Number(ex.weight)
        const parsedRir = Number(ex.rir)
        return {
          variationId: ex.variationId,
          sets: Math.max(1, Number(ex.sets) || 1),
          reps: repTarget.reps,
          repsMin: repTarget.repsMin,
          weight: ex.weight.trim() && Number.isFinite(parsedWeight) ? Math.max(0, parsedWeight) : undefined,
          rir: ex.rir.trim() && Number.isFinite(parsedRir) ? Math.max(0, Math.round(parsedRir)) : undefined,
        }
      }),
  }
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

export function ImportProgramDialog({
  exerciseOptions,
  onClose,
  onImported,
  open,
  token,
  trainees,
}: ImportProgramDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState<Step>("upload")
  const [fileName, setFileName] = useState("")
  const [draft, setDraft] = useState<ImportedProgramDraft | null>(null)
  const [editableWorkouts, setEditableWorkouts] = useState<EditableWorkout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedName, setSavedName] = useState("")
  const [programName, setProgramName] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate")
  const [duration, setDuration] = useState(4)
  const [assignEnabled, setAssignEnabled] = useState(true)

  const variationById = useMemo(
    () => new Map(exerciseOptions.map((exercise) => [exercise.id, exercise] as const)),
    [exerciseOptions],
  )

  const payload = useMemo((): CreateCoachProgramInput | null => {
    if (!draft) return null
    const name = programName.trim() || draft.name?.trim() || fileName.replace(/\.[^.]+$/, "") || "Imported program"
    return {
      assignToUserIds: assignEnabled ? (draft.assignToUserIds ?? []) : [],
      description: draft.description?.trim() || undefined,
      difficulty,
      duration,
      name,
      workouts: editableWorkouts
        .map(editableToPayloadWorkout)
        .filter((w) => w.exercises.length > 0),
    }
  }, [assignEnabled, difficulty, draft, duration, editableWorkouts, fileName, programName])

  const exerciseCount = useMemo(
    () => editableWorkouts.reduce((sum, w) => sum + w.exercises.length, 0),
    [editableWorkouts],
  )

  const invalidVariationCount = useMemo(() => {
    if (variationById.size === 0) return 0
    return editableWorkouts.reduce(
      (sum, w) => sum + w.exercises.filter((ex) => !variationById.has(ex.variationId)).length,
      0,
    )
  }, [editableWorkouts, variationById])

  const reset = () => {
    setStep("upload")
    setFileName("")
    setDraft(null)
    setEditableWorkouts([])
    setError(null)
    setIsDragging(false)
    setIsParsing(false)
    setIsSaving(false)
    setSavedName("")
    setProgramName("")
    setDifficulty("intermediate")
    setDuration(4)
    setAssignEnabled(true)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset()
      onClose()
    }
  }

  const handleFile = async (file?: File | null) => {
    if (!file) return
    setIsParsing(true)
    setError(null)
    setDraft(null)
    setEditableWorkouts([])
    setFileName(file.name)

    try {
      const { importCoachProgramTemplate } = await import("@/components/coach/program-excel")
      const importedDraft = await importCoachProgramTemplate(file, exerciseOptions, trainees)
      setDraft(importedDraft)
      setEditableWorkouts(importedDraft.workouts.map(workoutToEditable))
      setProgramName(importedDraft.name?.trim() || file.name.replace(/\.[^.]+$/, ""))
      setDifficulty(importedDraft.difficulty ?? "intermediate")
      setDuration(importedDraft.duration ?? 4)
      setAssignEnabled((importedDraft.assignToUserIds?.length ?? 0) > 0)
      setStep("review")
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Không đọc được file Excel.")
      setStep("review")
    } finally {
      setIsParsing(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setError(null)
    try {
      const { downloadCoachProgramTemplate } = await import("@/components/coach/program-excel")
      await downloadCoachProgramTemplate(exerciseOptions, trainees)
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Không tạo được template Excel.")
    }
  }

  const handleCreate = async () => {
    if (!token || !payload) return
    setIsSaving(true)
    setError(null)
    try {
      const program = await createCoachProgram(token, payload)
      setSavedName(program.name)
      onImported(program)
      setStep("done")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể tạo program từ file Excel.")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Exercise edit helpers ──────────────────────────────────────────────────

  const updateExercise = (
    workoutIdx: number,
    exerciseIdx: number,
    patch: Partial<EditableExercise>,
  ) => {
    setEditableWorkouts((prev) =>
      prev.map((w, wi) =>
        wi !== workoutIdx
          ? w
          : {
              ...w,
              exercises: w.exercises.map((ex, ei) =>
                ei !== exerciseIdx ? ex : { ...ex, ...patch },
              ),
            },
      ),
    )
  }

  const removeExercise = (workoutIdx: number, exerciseIdx: number) => {
    setEditableWorkouts((prev) =>
      prev
        .map((w, wi) =>
          wi !== workoutIdx
            ? w
            : { ...w, exercises: w.exercises.filter((_, ei) => ei !== exerciseIdx) },
        )
        .filter((w) => w.exercises.length > 0),
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 flex h-[100svh] max-h-[100svh] min-h-0 max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-border p-0 shadow-2xl sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90svh] sm:max-w-[800px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[14px]"
      >
        <DialogHeader className="border-b border-border px-5 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-micro mb-1.5">Import program</p>
              <DialogTitle className="text-[22px] font-semibold tracking-[-0.02em]">
                Tạo program từ Excel
              </DialogTitle>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleOpenChange(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 overflow-x-auto font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {STEPS.map((item, index) => {
              const active = step === item.value
              const complete = STEPS.findIndex((candidate) => candidate.value === step) > index
              return (
                <span key={item.value} className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                      active || complete ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {complete ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  {item.label}
                  {index < 2 ? <span className="h-px w-6 bg-border" /> : null}
                </span>
              )
            })}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {/* ── Upload step ── */}
          {step === "upload" ? (
            <div className="space-y-5">
              <button
                type="button"
                className={cn(
                  "flex min-h-[210px] w-full flex-col items-center justify-center rounded-[10px] border border-dashed bg-muted/40 px-6 text-center transition-colors",
                  isDragging ? "border-primary bg-primary-soft" : "border-border hover:border-input",
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                  void handleFile(event.dataTransfer.files[0])
                }}
              >
                {isParsing ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <UploadCloud className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="mt-3 text-sm font-semibold text-foreground">Kéo file .xlsx vào đây</span>
                <span className="mt-1 text-xs text-muted-foreground">hoặc bấm để chọn file từ máy</span>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
              </button>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="bg-transparent" onClick={() => void handleDownloadTemplate()}>
                  <FileDown className="h-4 w-4" />
                  Tải template mẫu
                </Button>
              </div>

              <div className="rounded-[10px] border border-border px-4 py-3">
                <Label className="label-micro mb-2 block">Workbook cần các sheet</Label>
                <div className="space-y-2 font-mono text-[11px] leading-5 text-muted-foreground">
                  <SheetHint name="Program" columns="name · description · duration_weeks · difficulty · assign_to_emails" />
                  <SheetHint name="Workouts" columns="workout_name · scheduled_day · exercise_name · variation_id · sets · reps_range · weight · rir_rpe" />
                  <SheetHint name="Trainees" columns="trainee_name · email (tùy chọn, để gán)" />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Mỗi dòng Workouts là một bài tập; các dòng cùng scheduled_day được gộp thành một buổi.
                  variation_id được dùng trực tiếp từ file Excel.
                </p>
              </div>
            </div>
          ) : null}

          {/* ── Review step ── */}
          {step === "review" ? (
            <div className="space-y-4">
              {/* Program name + difficulty + weeks */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Label className="label-micro mb-1.5 block">Tên program</Label>
                  <Input value={programName} onChange={(event) => setProgramName(event.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="label-micro block">Số tuần</Label>
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 text-center font-mono"
                  />
                </div>
                <div>
                  <Label className="label-micro mb-1.5 block">Độ khó</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DIFFICULTIES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={cn(
                          "h-9 rounded-full border px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors",
                          difficulty === item
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setDifficulty(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-[10px] border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    File import chưa hợp lệ
                  </div>
                  {error}
                </div>
              ) : null}

              {payload && draft ? (
                <>
                  {payload.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{payload.description}</p>
                  ) : null}

                  {/* Stats summary */}
                  <div className="flex flex-wrap gap-5">
                    <Stat value={duration} label="weeks" />
                    <Stat value={editableWorkouts.length} label="sessions" />
                    <Stat value={exerciseCount} label="exercises" />
                  </div>

                  {/* Assign toggle */}
                  {draft.assignToUserIds && draft.assignToUserIds.length > 0 ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-[10px] border border-border px-4 py-3 text-left text-sm"
                      onClick={() => setAssignEnabled((current) => !current)}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border",
                          assignEnabled ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {assignEnabled ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="text-muted-foreground">
                        Gán cho <b className="text-foreground">{draft.assignToUserIds.length} trainee</b> khi tạo
                      </span>
                    </button>
                  ) : null}

                  {/* Validation badge */}
                  {invalidVariationCount > 0 ? (
                    <div className="flex items-center gap-2 rounded-[10px] bg-warn-soft px-4 py-3 text-sm text-warning">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        <b>{invalidVariationCount}</b> variation_id không có trong thư viện hiện tại.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[10px] bg-ok-soft px-4 py-3 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Tất cả variation_id hợp lệ - sẵn sàng tạo.</span>
                    </div>
                  )}

                  {/* Editable workout list */}
                  <div className="space-y-3">
                    {editableWorkouts.map((workout, workoutIdx) => (
                      <div
                        key={`${workout.scheduledDay}-${workoutIdx}`}
                        className="rounded-[10px] border border-border px-4 py-3"
                      >
                        {/* Workout header */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                            {typeof workout.scheduledDay === "number" ? DAY_LABELS[workout.scheduledDay] : "Day"}
                          </span>
                          <h3 className="text-sm font-semibold text-foreground">{workout.name}</h3>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            · {workout.exercises.length} bài
                          </span>
                        </div>

                        {/* Column headers (desktop) */}
                        <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_60px_44px_56px_52px_40px_28px] items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground md:grid">
                          <span>Exercise</span>
                          <span className="text-center">ID</span>
                          <span className="text-center">Sets</span>
                          <span className="text-center">Reps</span>
                          <span className="text-center">Kg</span>
                          <span className="text-center">RIR</span>
                          <span />
                        </div>

                        {/* Exercise rows */}
                        <div className="space-y-1.5">
                          {workout.exercises.map((ex, exerciseIdx) => {
                            const option = variationById.get(ex.variationId)
                            return (
                              <div
                                key={`${ex.variationId}-${exerciseIdx}`}
                                className="grid items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-2 md:grid-cols-[minmax(0,1fr)_60px_44px_56px_52px_40px_28px]"
                              >
                                {/* Exercise name */}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {option?.exerciseName ?? "Unknown exercise"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {option?.variationName ?? ex.variationId}
                                  </p>
                                </div>

                                {/* ID badge */}
                                <span className="hidden items-center justify-center gap-1 md:inline-flex" title={ex.variationId}>
                                  {option ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                  ) : (
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                  )}
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {ex.variationId.slice(0, 5)}…
                                  </span>
                                </span>

                                {/* Editable number fields */}
                                <MiniInput
                                  value={ex.sets}
                                  placeholder="3"
                                  onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { sets: v })}
                                />
                                <MiniInput
                                  value={ex.reps}
                                  placeholder="8-12"
                                  onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { reps: v })}
                                />
                                <MiniInput
                                  value={ex.weight}
                                  placeholder="—"
                                  onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { weight: v })}
                                />
                                <MiniInput
                                  value={ex.rir}
                                  placeholder="—"
                                  onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { rir: v })}
                                />

                                {/* Remove button */}
                                <button
                                  type="button"
                                  title="Xoá bài tập"
                                  onClick={() => removeExercise(workoutIdx, exerciseIdx)}
                                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>

                                {/* Mobile summary (shown instead of fields) */}
                                <div className="flex flex-wrap gap-x-3 gap-y-1 md:hidden">
                                  <MobileField label="Sets" value={ex.sets} placeholder="3"
                                    onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { sets: v })} />
                                  <MobileField label="Reps" value={ex.reps} placeholder="8-12"
                                    onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { reps: v })} />
                                  <MobileField label="Kg" value={ex.weight} placeholder="—"
                                    onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { weight: v })} />
                                  <MobileField label="RIR" value={ex.rir} placeholder="—"
                                    onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { rir: v })} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {/* ── Done step ── */}
          {step === "done" ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok-soft">
                <CheckCircle2 className="h-7 w-7 text-success" />
              </span>
              <h3 className="mt-4 text-xl font-semibold">Đã tạo &ldquo;{savedName}&rdquo;</h3>
              <p className="mt-2 text-sm text-muted-foreground">Program mới đã được thêm vào danh sách của coach.</p>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[68px] items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">{step === "review" ? fileName : ""}</p>
          <div className="flex shrink-0 gap-2">
            {step === "upload" ? (
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Hủy
              </Button>
            ) : null}
            {step === "review" ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setStep("upload")} disabled={isSaving}>
                  <ArrowLeft className="h-4 w-4" />
                  Lại
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={!payload || Boolean(error) || isSaving || !token}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isSaving ? "Đang tạo..." : "Tạo program"}
                </Button>
              </>
            ) : null}
            {step === "done" ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Xong
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Small helper components ─────────────────────────────────────────────────

function MiniInput({
  onChange,
  placeholder,
  value,
}: {
  onChange: (v: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "hidden h-8 w-full rounded border border-border bg-background px-1.5 text-center font-mono text-xs text-foreground md:block",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
      )}
    />
  )
}

function MobileField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (v: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-7 w-16 rounded border border-border bg-background px-1.5 text-center font-mono text-xs text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring",
        )}
      />
    </label>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-xl font-semibold text-foreground tnum">{value}</span>
      <span className="label-micro">{label}</span>
    </div>
  )
}

function SheetHint({ columns, name }: { columns: string; name: string }) {
  return (
    <p className="grid gap-1 sm:grid-cols-[78px_minmax(0,1fr)]">
      <span className="font-semibold text-foreground">{name}</span>
      <span>{columns}</span>
    </p>
  )
}
