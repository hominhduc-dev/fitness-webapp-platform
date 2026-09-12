"use client"

import { AlertCircle, AlertTriangle, ArrowLeft, Check, CheckCircle2, FileDown, Loader2, Trash2, UploadCloud, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ImportedProgramDraft } from "@/components/coach/program-excel"
import { buildWorkoutsFromRows } from "@/components/coach/program-import-rows"
import {
  createCoachProgram,
  fetchNotionProgramTemplates,
  importNotionProgram,
  overwriteNotionProgram,
} from "@/lib/fitness/api"
import type {
  CoachProgram,
  CoachTrainee,
  CreateCoachProgramInput,
  ExerciseVariationOption,
  NotionExistingProgram,
  NotionProgramTemplate,
} from "@/lib/fitness/types"
import { parseRepTargetText } from "@/lib/workout-reps"
import { cn } from "@/lib/utils"
import { GoogleProgramSource } from "./google-program-source"
import { fetchGoogleConnection, overwriteGoogleProgram, type GoogleConnectionStatus, type GoogleImportResult } from "@/lib/fitness/api"
import { useLocale } from "@/components/providers/locale-provider"
import { googleImportMessages } from "@/lib/i18n/messages/google-import"

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
type ImportSource = "excel" | "notion" | "google"

const STEPS: Array<{ label: string; value: Step }> = [
  { label: "Upload", value: "upload" },
  { label: "Review", value: "review" },
  { label: "Done", value: "done" },
]

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"]

// ─── Editable workout types ─────────────────────────────────────────────────

type EditableExercise = {
  notes?: string
  restTime?: number
  variationId: string
  sets: string
  reps: string   // "8-12" or "10"
  weight: string
  rir: string
}

type EditableWorkout = {
  weekIndex?: number
  name: string
  scheduledDay?: number
  exercises: EditableExercise[]
}

function workoutToEditable(workout: CreateCoachProgramInput["workouts"][number]): EditableWorkout {
  return {
    name: workout.name,
    weekIndex: workout.weekIndex,
    scheduledDay: workout.scheduledDay,
    exercises: workout.exercises.map((ex) => ({
      notes: ex.notes,
      restTime: ex.restTime,
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
    weekIndex: editable.weekIndex,
    scheduledDay: editable.scheduledDay,
    exercises: editable.exercises
      .filter((ex) => ex.variationId)
      .map((ex) => {
        const repTarget = parseRepTargetText(ex.reps) ?? { reps: Math.max(1, Number(ex.reps) || 1) }
        const parsedWeight = Number(ex.weight)
        const parsedRir = Number(ex.rir)
        return {
          notes: ex.notes,
          restTime: ex.restTime,
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
  const { locale } = useLocale()
  const googleText = googleImportMessages[locale]
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionStatus>({ configured: false, connected: false, email: null })
  const [googleSource, setGoogleSource] = useState<GoogleImportResult | null>(null)
  useEffect(() => {
    if (!open || !token) return
    let cancelled = false
    void fetchGoogleConnection(token).then((value) => { if (!cancelled) setGoogleConnection(value) }).catch(() => { if (!cancelled) setGoogleConnection({ configured: false, connected: false, email: null }) })
    return () => { cancelled = true }
  }, [open, token])
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
  const [source, setSource] = useState<ImportSource>("excel")
  const [notionConfigured, setNotionConfigured] = useState(false)
  const [notionTemplates, setNotionTemplates] = useState<NotionProgramTemplate[]>([])
  const [notionTemplatesLoaded, setNotionTemplatesLoaded] = useState(false)
  const [notionSelection, setNotionSelection] = useState("")
  const [notionLink, setNotionLink] = useState("")
  const [notionWarnings, setNotionWarnings] = useState<string[]>([])
  const [notionIssues, setNotionIssues] = useState<string[]>([])
  const [notionExisting, setNotionExisting] = useState<NotionExistingProgram | null>(null)
  const [notionSourceId, setNotionSourceId] = useState("")
  const [didOverwrite, setDidOverwrite] = useState(false)

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
      ...(googleSource ? { googleSpreadsheetId: googleSource.spreadsheetId, googleSheetName: googleSource.sheetName } : {}),
      workouts: editableWorkouts
        .map(editableToPayloadWorkout)
        .filter((w) => w.exercises.length > 0),
    }
  }, [assignEnabled, difficulty, draft, duration, editableWorkouts, fileName, programName, googleSource])

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
    setGoogleSource(null)
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
    setSource("excel")
    setNotionSelection("")
    setNotionLink("")
    setNotionWarnings([])
    setNotionIssues([])
    setNotionExisting(null)
    setNotionSourceId("")
    setDidOverwrite(false)
  }

  // Loaded once per mount: the template list is small and rarely changes mid-session.
  useEffect(() => {
    if (!open || !token || notionTemplatesLoaded) return

    let cancelled = false

    void fetchNotionProgramTemplates(token)
      .then((result) => {
        if (cancelled) return
        setNotionConfigured(result.configured)
        setNotionTemplates(result.templates)
      })
      // A Notion outage must not break the Excel path, so the tab just stays hidden.
      .catch(() => {
        if (!cancelled) setNotionConfigured(false)
      })
      .finally(() => {
        if (!cancelled) setNotionTemplatesLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [notionTemplatesLoaded, open, token])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset()
      onClose()
    }
  }

  const handleFile = async (file?: File | null) => {
    if (!file) return
    setGoogleSource(null)
    setNotionSourceId("")
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

  /**
   * Pulls one Notion template and turns its rows into the same draft the Excel
   * parser produces, so the review step downstream is unaware of the source.
   */
  const handleNotionImport = async (templateRef: string) => {
    if (!token || !templateRef.trim()) return
    setGoogleSource(null)

    setIsParsing(true)
    setError(null)
    setDraft(null)
    setEditableWorkouts([])
    setNotionIssues([])
    setNotionWarnings([])
    setNotionExisting(null)
    setNotionSourceId("")

    try {
      const result = await importNotionProgram(token, templateRef.trim())
      const { issues, workouts } = buildWorkoutsFromRows(result.rows, exerciseOptions, {
        duration: result.program.duration,
      })

      setNotionWarnings(result.warnings)

      // Every failing row is listed at once: the coach fixes Notion in a single
      // pass instead of re-importing to discover the next typo.
      if (issues.length > 0) {
        setNotionIssues(issues.map((issue) => issue.message))
        setError(`${issues.length} dòng trong Notion chưa hợp lệ. Sửa trên Notion rồi import lại.`)
        return
      }

      setNotionExisting(result.existingProgram)
      setNotionSourceId(result.program.notionPageId)
      setFileName(result.program.name)
      setDraft({ workouts, weekTemplate: result.weekTemplateMode })
      setEditableWorkouts(workouts.map(workoutToEditable))
      setProgramName(result.program.name)
      setDifficulty(result.program.difficulty)
      setDuration(result.program.duration)
      setAssignEnabled(false)
      setStep("review")
    } catch (notionError) {
      setError(notionError instanceof Error ? notionError.message : "Không đọc được dữ liệu từ Notion.")
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
      const program = await createCoachProgram(
        token,
        notionSourceId ? { ...payload, notionSourceId } : payload,
      )
      setSavedName(program.name)
      onImported(program)
      setStep("done")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể tạo program từ file Excel.")
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Replaces the program a previous import of this same template produced.
   *
   * `assignToUserIds` is deliberately left out: the backend then keeps whoever is
   * already following the program instead of unassigning every trainee.
   */
  const handleOverwrite = async () => {
    if (!token || !payload || !notionExisting || !notionSourceId) return

    setIsSaving(true)
    setError(null)

    try {
      setDidOverwrite(true)
      const program = await overwriteNotionProgram(token, notionExisting.id, {
        description: payload.description,
        difficulty: payload.difficulty,
        duration: payload.duration,
        name: payload.name,
        notionSourceId,
        workouts: payload.workouts,
      })
      setSavedName(program.name)
      onImported(program)
      setStep("done")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không ghi đè được program cũ.")
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
                {source === "notion" ? "Tạo program từ Notion" : "Tạo program từ Excel"}
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
              {error ? <p role="alert" className="whitespace-pre-line text-sm text-destructive-text">{error}</p> : null}
              {notionConfigured || googleConnection.configured ? (
                <div className="flex gap-1 rounded-[10px] border border-border p-1">
                  {(["excel", ...(notionConfigured ? ["notion"] : []), ...(googleConnection.configured ? ["google"] : [])] as ImportSource[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setSource(value); setError(null); setNotionIssues([]) }}
                      className={cn(
                        "flex-1 rounded-[7px] px-3 py-2 text-sm font-medium transition-colors",
                        source === value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {value === "excel" ? "Từ file Excel" : value === "google" ? googleText.tab : "Từ Notion"}
                    </button>
                  ))}
                </div>
              ) : null}

              {source === "google" && token ? <GoogleProgramSource token={token} connection={googleConnection} onConnection={setGoogleConnection} onImport={(result, name, weeks) => {
                const built = buildWorkoutsFromRows(result.rows, exerciseOptions, { duration: weeks })
                if (built.issues.length) { setError(built.issues.map((issue) => issue.message).join("\n")); return }
                setGoogleSource(result); setNotionSourceId(""); setNotionExisting(null); setNotionWarnings([]); setNotionIssues([]); setError(null)
                setDraft({ workouts: built.workouts, weekTemplate: true }); setEditableWorkouts(built.workouts.map(workoutToEditable)); setFileName(name); setProgramName(name); setDuration(weeks); setAssignEnabled(false); setStep("review")
              }} /> : source === "notion" ? (
                <div className="space-y-4">
                  <div>
                    <Label className="label-micro mb-1.5 block">Chọn program mẫu</Label>
                    {notionTemplates.length === 0 ? (
                      <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                        Chưa có program mẫu nào ở trạng thái ready trong Notion.
                      </p>
                    ) : (
                      <div className="max-h-[260px] space-y-1.5 overflow-y-auto">
                        {notionTemplates.map((template) => (
                          <button
                            key={template.notionPageId}
                            type="button"
                            disabled={isParsing}
                            onClick={() => { setNotionSelection(template.notionPageId); setNotionLink("") }}
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors",
                              notionSelection === template.notionPageId
                                ? "border-primary bg-primary-soft"
                                : "border-border hover:border-input",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">{template.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {template.duration} tuần · {template.difficulty}
                              </span>
                            </span>
                            {notionSelection === template.notionPageId ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="label-micro mb-1.5 block">Hoặc dán link Notion</Label>
                    <Input
                      value={notionLink}
                      placeholder="https://www.notion.so/..."
                      disabled={isParsing}
                      onChange={(event) => { setNotionLink(event.target.value); setNotionSelection("") }}
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    disabled={isParsing || (!notionSelection && !notionLink.trim())}
                    onClick={() => void handleNotionImport(notionLink.trim() || notionSelection)}
                  >
                    {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Đọc dữ liệu từ Notion
                  </Button>

                  {notionIssues.length > 0 ? (
                    <div className="rounded-[10px] border border-destructive/40 bg-destructive/5 px-4 py-3">
                      <p className="mb-2 text-xs font-semibold text-destructive">
                        {notionIssues.length} dòng cần sửa trên Notion
                      </p>
                      <ul className="max-h-[200px] space-y-1 overflow-y-auto text-xs leading-5 text-muted-foreground">
                        {notionIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
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
                  <SheetHint name="Week 1" columns="Day · Exercise · Sets · Rep Range · Weight (kg) · RIR · Rest (s) · Note" />
                  <SheetHint name="Exercise Table" columns={googleText.library} />
                  <SheetHint name="Trainees" columns="trainee_name · email (tùy chọn, để gán)" />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {googleText.templateHelp}
                </p>
              </div>
                </>
              )}
            </div>
          ) : null}

          {/* ── Review step ── */}
          {step === "review" ? (
            <div className="space-y-4">
              {googleSource?.existingProgram ? <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm">{googleText.duplicate} {googleSource.existingProgram.name}</p>
                <Button variant="outline" disabled={isSaving || !payload || !token || !!googleSource.existingProgram.archivedAt} onClick={() => {
                  if (!token || !payload || !googleSource.existingProgram) return
                  setIsSaving(true); setError(null)
                  void overwriteGoogleProgram(token, googleSource.existingProgram.id, payload).then((program) => { setDidOverwrite(true); setSavedName(program.name); onImported(program); setStep("done") }).catch((error) => setError(error instanceof Error ? error.message : googleText.failed)).finally(() => setIsSaving(false))
                }}>{googleText.overwrite}</Button>
              </div> : null}
              {notionExisting ? (
                <div className="rounded-[10px] border border-warning/40 bg-warning/5 px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Program mẫu này đã được import trước đó
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    Bản cũ tên &quot;{notionExisting.name}&quot;
                    {notionExisting.assignedTraineeCount > 0
                      ? ` đang được ${notionExisting.assignedTraineeCount} trainee sử dụng`
                      : " chưa gán cho trainee nào"}
                    {notionExisting.archivedAt ? " và đang ở trạng thái lưu trữ" : ""}.
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {notionExisting.archivedAt
                      ? "Phải restore bản cũ trước khi ghi đè. Tạo mới vẫn dùng được."
                      : notionExisting.assignedTraineeCount > 0
                        ? "Ghi đè thay toàn bộ buổi tập của bản cũ. Trainee đang theo vẫn giữ nguyên ngày bắt đầu."
                        : "Ghi đè thay toàn bộ buổi tập của bản cũ."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="bg-transparent"
                      disabled={isSaving || Boolean(notionExisting.archivedAt) || !payload}
                      onClick={() => void handleOverwrite()}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Ghi đè bản cũ
                    </Button>
                    <span className="self-center text-xs text-muted-foreground">
                      hoặc bấm tạo ở dưới để giữ cả hai
                    </span>
                  </div>
                </div>
              ) : null}

              {notionWarnings.length > 0 ? (
                <div className="rounded-[10px] border border-border bg-muted/40 px-4 py-3">
                  <p className="mb-1.5 text-xs font-semibold text-foreground">Lưu ý từ dữ liệu Notion</p>
                  <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                    {notionWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
                    onChange={(e) => {
                      const nextDuration = Math.min(52, Math.max(1, Math.round(Number(e.target.value) || 1)))
                      if (draft?.weekTemplate) setEditableWorkouts((current) => {
                        const next = current.filter((workout) => (workout.weekIndex ?? 1) <= nextDuration)
                        const template = current.filter((workout) => workout.weekIndex === 1)
                        for (let week = 2; week <= nextDuration; week++) if (!next.some((workout) => workout.weekIndex === week)) {
                          next.push(...template.map((workout) => ({ ...workout, weekIndex: week, exercises: workout.exercises.map((exercise) => ({ ...exercise })) })))
                        }
                        return next
                      })
                      setDuration(nextDuration)
                    }}
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
                <div className="rounded-[10px] border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text">
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
                    <div className="flex items-center gap-2 rounded-[10px] bg-warn-soft px-4 py-3 text-sm text-warning-text">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        <b>{invalidVariationCount}</b> variation_id không có trong thư viện hiện tại.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[10px] bg-ok-soft px-4 py-3 text-sm text-success-text">
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
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success-text" />
                                  ) : (
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive-text" />
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
                                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive-text"
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
                <CheckCircle2 className="h-7 w-7 text-success-text" />
              </span>
              <h3 className="mt-4 text-xl font-semibold">
                {didOverwrite ? "Đã ghi đè" : "Đã tạo"} &ldquo;{savedName}&rdquo;
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {didOverwrite
                  ? "Buổi tập của program cũ đã được thay mới. Trainee đang theo vẫn giữ nguyên."
                  : "Program mới đã được thêm vào danh sách của coach."}
              </p>
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
