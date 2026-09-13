"use client"

import { AlertCircle, AlertTriangle, ArrowLeft, Check, CheckCircle2, FileDown, FileSpreadsheet, FileText, Link2, Loader2, RefreshCw, Trash2, X } from "lucide-react"
import { useMemo, useState } from "react"

import { useCoachData, useCoachMutation } from "@/lib/queries/coach-data"
import { queryKeys } from "@/lib/queries/keys"
import { useAuth } from "@/components/providers/auth-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GoogleIcon, NotionIcon } from "@/components/ui/brand-icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { IconTile } from "@/components/ui/icon-tile"
import { Input } from "@/components/ui/input"
import { InputWithIcon } from "@/components/ui/input-with-icon"
import { Label } from "@/components/ui/label"
import { OptionRow } from "@/components/ui/option-row"
import { Stepper } from "@/components/ui/stepper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ImportedProgramDraft } from "@/components/coach/program-excel"
import { buildWorkoutsFromRows } from "@/components/coach/program-import-rows"
import {
  INTENSITY_TAG_BADGES,
  normalizeSetIntensityAssignments,
  type SetIntensityAssignment,
} from "@/lib/workout/intensity-tag"
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
} from "@/lib/fitness/types"
import { parseRepTargetText } from "@/lib/workout-reps"
import { cn } from "@/lib/utils"
import { GoogleProgramSource } from "./google-program-source"
import { fetchGoogleConnection, overwriteGoogleProgram, type GoogleImportResult } from "@/lib/fitness/api"
import { useLocale } from "@/components/providers/locale-provider"
import { googleImportMessages } from "@/lib/i18n/messages/google-import"
import { programImportMessages } from "@/lib/i18n/messages/program-import"

type ImportProgramDialogProps = {
  exerciseOptions: ExerciseVariationOption[]
  onClose: () => void
  onImported: (program: CoachProgram) => void
  open: boolean
  token?: string
  trainees: CoachTrainee[]
}

type Step = "upload" | "review" | "done"
type Difficulty = CreateCoachProgramInput["difficulty"]
type ImportSource = "excel" | "notion" | "google"

const STEP_ORDER: Step[] = ["upload", "review", "done"]

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"]

function ImportSourceIcon({ source }: { source: ImportSource }) {
  if (source === "excel") return <FileSpreadsheet className="size-5" />
  if (source === "notion") return <NotionIcon className="size-5" />
  // The multicolour mark needs a light chip to stay legible on the selected tab.
  return (
    <IconTile size="sm" tone="surface" className="size-7 rounded-full [&_svg]:size-4">
      <GoogleIcon />
    </IconTile>
  )
}

// ─── Editable workout types ─────────────────────────────────────────────────

type EditableExercise = {
  notes?: string
  restTime?: number
  variationId: string
  /** Read from the sheet's Method column; shown as badges on the review row. */
  setIntensityTags?: SetIntensityAssignment[]
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
      setIntensityTags: ex.setIntensityTags,
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
        const sets = Math.max(1, Number(ex.sets) || 1)
        // A coach who edits the set count down here loses the tags on the sets
        // they removed, exactly as in the program editor.
        const setIntensityTags = normalizeSetIntensityAssignments(ex.setIntensityTags, sets)
        return {
          notes: ex.notes,
          restTime: ex.restTime,
          variationId: ex.variationId,
          setIntensityTags: setIntensityTags.length ? setIntensityTags : undefined,
          sets,
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
  trainees,
}: ImportProgramDialogProps) {
  const { locale } = useLocale()
  const t = programImportMessages[locale]
  const googleText = googleImportMessages[locale]
  const { profile } = useAuth()
  const authenticated = Boolean(profile?.id)
  const googleQuery = useCoachData(queryKeys.coach.googleConnection(), fetchGoogleConnection, undefined, open, 30_000)
  const googleConnection = googleQuery.data ?? { configured: false, connected: false, email: null }
  const setGoogleConnection = googleQuery.setData
  const [googleSource, setGoogleSource] = useState<GoogleImportResult | null>(null)
  const templatesQuery = useCoachData(queryKeys.coach.notionTemplates(), fetchNotionProgramTemplates, undefined, open)
  const notionConfigured = templatesQuery.data?.configured ?? false
  const notionTemplates = templatesQuery.data?.templates ?? []
  const createProgram = useCoachMutation(createCoachProgram)
  const overwriteNotion = useCoachMutation(overwriteNotionProgram)
  const overwriteGoogle = useCoachMutation(overwriteGoogleProgram)
  const notionPreview = useCoachMutation(importNotionProgram, [])
  const [step, setStep] = useState<Step>("upload")
  const [fileName, setFileName] = useState("")
  const [draft, setDraft] = useState<ImportedProgramDraft | null>(null)
  const [editableWorkouts, setEditableWorkouts] = useState<EditableWorkout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedName, setSavedName] = useState("")
  const [programName, setProgramName] = useState("")
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate")
  const [duration, setDuration] = useState(4)
  const [assignEnabled, setAssignEnabled] = useState(true)
  const [source, setSource] = useState<ImportSource>("excel")
  const [notionSelection, setNotionSelection] = useState("")
  const [notionLink, setNotionLink] = useState("")
  const [notionWarnings, setNotionWarnings] = useState<string[]>([])
  const [notionIssues, setNotionIssues] = useState<string[]>([])
  const [notionExisting, setNotionExisting] = useState<NotionExistingProgram | null>(null)
  const [notionSourceId, setNotionSourceId] = useState("")
  const [didOverwrite, setDidOverwrite] = useState(false)
  const sourceText = t.sources[source]
  const steps = STEP_ORDER.map((value) => ({ label: t.steps[value], value }))
  const visibleSources: ImportSource[] = [
    "excel",
    ...(notionConfigured ? (["notion"] as const) : []),
    ...(googleConnection.configured ? (["google"] as const) : []),
  ]
  const workbookSheets = [
    { columns: "name · description · duration_weeks · difficulty · assign_to_emails", name: "Program" },
    { columns: "Day · Exercise · Sets · Rep Range · Weight (kg) · RIR · Rest (s) · Note", name: "Week 1" },
    { columns: googleText.library, name: "Exercise Table" },
    { columns: t.excel.traineeColumns, name: "Trainees" },
  ]
  const difficultyLabel = (value: string) => t.difficulty[value as Difficulty] ?? value

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
      setError(importError instanceof Error ? importError.message : t.errors.excelRead)
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
    if (!authenticated || !templateRef.trim()) return
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
      const result = await notionPreview.mutateAsync([templateRef.trim()])
      const { issues, workouts } = buildWorkoutsFromRows(result.rows, exerciseOptions, {
        duration: result.program.duration,
      })

      setNotionWarnings(result.warnings)

      // Every failing row is listed at once: the coach fixes Notion in a single
      // pass instead of re-importing to discover the next typo.
      if (issues.length > 0) {
        setNotionIssues(issues.map((issue) => issue.message))
        setError(t.errors.notionRows(issues.length))
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
      setError(notionError instanceof Error ? notionError.message : t.errors.notionRead)
    } finally {
      setIsParsing(false)
    }
  }

  const handleGoogleImport = (result: GoogleImportResult, name: string, weeks: number) => {
    const built = buildWorkoutsFromRows(result.rows, exerciseOptions, { duration: weeks })
    if (built.issues.length) {
      setError(built.issues.map((issue) => issue.message).join("\n"))
      return
    }
    setGoogleSource(result)
    setNotionSourceId("")
    setNotionExisting(null)
    setNotionWarnings([])
    setNotionIssues([])
    setError(null)
    setDraft({ workouts: built.workouts, weekTemplate: true })
    setEditableWorkouts(built.workouts.map(workoutToEditable))
    setFileName(name)
    setProgramName(name)
    setDuration(weeks)
    setAssignEnabled(false)
    setStep("review")
  }

  const handleDownloadTemplate = async () => {
    setError(null)
    try {
      const { downloadCoachProgramTemplate } = await import("@/components/coach/program-excel")
      await downloadCoachProgramTemplate(exerciseOptions, trainees)
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : t.errors.template)
    }
  }

  const handleCreate = async () => {
    if (!authenticated || !payload) return
    setIsSaving(true)
    setError(null)
    try {
      const program = await createProgram.mutateAsync([
        notionSourceId ? { ...payload, notionSourceId } : payload,
      ])
      setSavedName(program.name)
      onImported(program)
      setStep("done")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.errors.create)
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
    if (!authenticated || !payload || !notionExisting || !notionSourceId) return

    setIsSaving(true)
    setError(null)

    try {
      setDidOverwrite(true)
      const program = await overwriteNotion.mutateAsync([notionExisting.id, {
        description: payload.description,
        difficulty: payload.difficulty,
        duration: payload.duration,
        name: payload.name,
        notionSourceId,
        workouts: payload.workouts,
      }])
      setSavedName(program.name)
      onImported(program)
      setStep("done")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.errors.overwrite)
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
        className="left-0 top-0 flex h-[100svh] max-h-[100svh] min-h-0 max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-border p-0 shadow-2xl sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[92svh] sm:max-w-[920px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <DialogHeader className="shrink-0 gap-0 border-b border-border px-5 pb-4 pt-5 text-left sm:px-8 sm:pb-5 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="label-micro">{t.eyebrow}</p>
              <DialogTitle className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                {sourceText.title}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-6 sm:text-base">
                {sourceText.description}
              </DialogDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenChange(false)} aria-label={t.close}>
              <X className="size-5" />
            </Button>
          </div>
          <Stepper className="mt-5" current={step} steps={steps} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
          {/* ── Upload step ── */}
          {step === "upload" ? (
            <Tabs
              value={source}
              onValueChange={(value) => {
                setSource(value as ImportSource)
                setError(null)
                setNotionIssues([])
              }}
              className="gap-5"
            >
              {visibleSources.length > 1 ? (
                <TabsList variant="segmented" aria-label={t.sourceTabs}>
                  {visibleSources.map((value) => (
                    <TabsTrigger key={value} value={value}>
                      <ImportSourceIcon source={value} />
                      <span className="min-w-0 truncate">{t.sources[value].label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              ) : null}

              {error ? (
                <Alert role="alert" variant="destructive">
                  <AlertCircle />
                  <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
                </Alert>
              ) : null}

              <TabsContent value="excel" className="space-y-4">
                <FileDropzone
                  accept=".xlsx,.xls"
                  actionLabel={t.excel.choose}
                  busy={isParsing}
                  footnote={t.excel.supported}
                  hint={t.excel.dropHint}
                  icon={<FileSpreadsheet />}
                  onFile={(file) => void handleFile(file)}
                  title={t.excel.dropTitle}
                />

                <Button type="button" variant="outline" onClick={() => void handleDownloadTemplate()}>
                  <FileDown />
                  {t.excel.downloadTemplate}
                </Button>

                <Card className="shadow-none">
                  <CardHeader className="p-4 pb-3 md:p-5 md:pb-3">
                    <p className="label-micro">{t.excel.workbookSheets}</p>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4 md:px-5 md:pb-5">
                    <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      {workbookSheets.map((sheet) => (
                        <SheetHint key={sheet.name} name={sheet.name} columns={sheet.columns} />
                      ))}
                    </dl>
                    <p className="text-xs leading-5 text-muted-foreground">{googleText.templateHelp}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notion" className="space-y-5">
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="label-micro">{t.notion.pickTemplate}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={templatesQuery.isFetching}
                      onClick={() => void templatesQuery.refetch()}
                    >
                      <RefreshCw className={cn(templatesQuery.isFetching && "animate-spin")} />
                      {t.notion.refresh}
                    </Button>
                  </div>
                  {notionTemplates.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      {t.notion.empty}
                    </p>
                  ) : (
                    <div className="max-h-[300px] space-y-2 overflow-y-auto">
                      {notionTemplates.map((template) => (
                        <OptionRow
                          key={template.notionPageId}
                          disabled={isParsing}
                          selected={notionSelection === template.notionPageId}
                          onClick={() => {
                            setNotionSelection(template.notionPageId)
                            setNotionLink("")
                          }}
                          icon={<IconTile><FileText /></IconTile>}
                          title={template.name}
                          description={t.notion.templateMeta(template.duration, difficultyLabel(template.difficulty))}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-2.5">
                  <Label htmlFor="notion-link" className="label-micro block">{t.notion.pasteLink}</Label>
                  <InputWithIcon
                    id="notion-link"
                    icon={<Link2 />}
                    value={notionLink}
                    placeholder="https://www.notion.so/..."
                    disabled={isParsing}
                    onChange={(event) => {
                      setNotionLink(event.target.value)
                      setNotionSelection("")
                    }}
                  />
                </section>

                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={isParsing || (!notionSelection && !notionLink.trim())}
                  onClick={() => void handleNotionImport(notionLink.trim() || notionSelection)}
                >
                  {isParsing ? <Loader2 className="animate-spin" /> : <NotionIcon />}
                  {t.notion.read}
                </Button>

                {notionIssues.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertDescription>
                      <p className="font-semibold">{t.notion.issuesTitle(notionIssues.length)}</p>
                      <ul className="mt-1 max-h-[200px] space-y-1 overflow-y-auto">
                        {notionIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </TabsContent>

              <TabsContent value="google">
                {authenticated ? (
                  <GoogleProgramSource
                    connection={googleConnection}
                    onConnection={setGoogleConnection}
                    onImport={handleGoogleImport}
                  />
                ) : null}
              </TabsContent>
            </Tabs>
          ) : null}

          {/* ── Review step ── */}
          {step === "review" ? (
            <div className="space-y-4">
              {googleSource?.existingProgram ? <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm">{googleText.duplicate} {googleSource.existingProgram.name}</p>
                <Button variant="outline" disabled={isSaving || !payload || !authenticated || !!googleSource.existingProgram.archivedAt} onClick={() => {
                  if (!authenticated || !payload || !googleSource.existingProgram) return
                  setIsSaving(true); setError(null)
                  void overwriteGoogle.mutateAsync([googleSource.existingProgram.id, payload]).then((program) => { setDidOverwrite(true); setSavedName(program.name); onImported(program); setStep("done") }).catch((error) => setError(error instanceof Error ? error.message : googleText.failed)).finally(() => setIsSaving(false))
                }}>{googleText.overwrite}</Button>
              </div> : null}
              {notionExisting ? (
                <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {t.notion.duplicateTitle}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {t.notion.duplicateSummary(notionExisting.name, notionExisting.assignedTraineeCount, Boolean(notionExisting.archivedAt))}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {notionExisting.archivedAt
                      ? t.notion.overwriteArchivedHelp
                      : notionExisting.assignedTraineeCount > 0
                        ? t.notion.overwriteAssignedHelp
                        : t.notion.overwriteHelp}
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
                      {t.notion.overwrite}
                    </Button>
                    <span className="self-center text-xs text-muted-foreground">
                      {t.notion.orCreate}
                    </span>
                  </div>
                </div>
              ) : null}

              {notionWarnings.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <p className="mb-1.5 text-xs font-semibold text-foreground">{t.notion.warningsTitle}</p>
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
                  <Label className="label-micro mb-1.5 block">{t.review.programName}</Label>
                  <Input value={programName} onChange={(event) => setProgramName(event.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="label-micro block">{t.review.weeks}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={duration}
                    onChange={(e) => {
                      const nextDuration = Math.min(52, Math.max(1, Math.round(Number(e.target.value) || 1)))
                      if (draft?.weekTemplate) setEditableWorkouts((current) => {
                        const next = current.filter((workout) => (workout.weekIndex ?? 0) < nextDuration)
                        const template = current.filter((workout) => (workout.weekIndex ?? 0) === 0)
                        for (let week = 1; week < nextDuration; week++) if (!next.some((workout) => workout.weekIndex === week)) {
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
                  <Label className="label-micro mb-1.5 block">{t.review.difficulty}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DIFFICULTIES.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={cn(
                          "h-9 rounded-full border px-3 font-mono text-micro font-semibold uppercase tracking-[0.06em] transition-colors",
                          difficulty === item
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setDifficulty(item)}
                      >
                        {difficultyLabel(item)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    {t.review.invalidTitle}
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
                    <Stat value={duration} label={t.review.statWeeks} />
                    <Stat value={editableWorkouts.length} label={t.review.statSessions} />
                    <Stat value={exerciseCount} label={t.review.statExercises} />
                  </div>

                  {/* Assign toggle */}
                  {draft.assignToUserIds && draft.assignToUserIds.length > 0 ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm"
                      onClick={() => setAssignEnabled((current) => !current)}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                          assignEnabled ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {assignEnabled ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="text-muted-foreground">
                        {t.review.assignBefore} <b className="text-foreground">{t.review.assignCount(draft.assignToUserIds.length)}</b> {t.review.assignAfter}
                      </span>
                    </button>
                  ) : null}

                  {/* Validation badge */}
                  {invalidVariationCount > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warning-text">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        <b>{invalidVariationCount}</b> {t.review.invalidVariations}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-ok-soft px-4 py-3 text-sm text-success-text">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{t.review.allValid}</span>
                    </div>
                  )}

                  {/* Editable workout list */}
                  <div className="space-y-3">
                    {editableWorkouts.map((workout, workoutIdx) => (
                      <div
                        key={`${workout.scheduledDay}-${workoutIdx}`}
                        className="rounded-lg border border-border px-4 py-3"
                      >
                        {/* Workout header */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                            {typeof workout.scheduledDay === "number" ? t.days[workout.scheduledDay] : t.review.day}
                          </span>
                          <h3 className="text-sm font-semibold text-foreground">{workout.name}</h3>
                          <span className="font-mono text-micro text-muted-foreground">
                            {t.review.exerciseCount(workout.exercises.length)}
                          </span>
                        </div>

                        {/* Column headers (desktop) */}
                        <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_60px_44px_56px_52px_40px_28px] items-center gap-1.5 font-mono text-micro uppercase tracking-[0.06em] text-muted-foreground md:grid">
                          <span>{t.review.columns.exercise}</span>
                          <span className="text-center">{t.review.columns.id}</span>
                          <span className="text-center">{t.review.columns.sets}</span>
                          <span className="text-center">{t.review.columns.reps}</span>
                          <span className="text-center">{t.review.columns.kg}</span>
                          <span className="text-center">{t.review.columns.rir}</span>
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
                                    {option?.displayName ?? option?.name ?? t.review.unknownExercise}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {option?.variationName ?? ex.variationId}
                                  </p>
                                  {normalizeSetIntensityAssignments(ex.setIntensityTags, Math.max(1, Number(ex.sets) || 1))
                                    .length > 0 ? (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {normalizeSetIntensityAssignments(
                                        ex.setIntensityTags,
                                        Math.max(1, Number(ex.sets) || 1),
                                      ).map(({ setNumber, tag }) => (
                                        <span
                                          key={setNumber}
                                          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-soft px-1.5 py-px font-mono text-micro font-semibold uppercase tracking-[0.08em] text-primary"
                                        >
                                          {setNumber}
                                          <span>{INTENSITY_TAG_BADGES[tag]}</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                {/* ID badge */}
                                <span className="hidden items-center justify-center gap-1 md:inline-flex" title={ex.variationId}>
                                  {option ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success-text" />
                                  ) : (
                                    <AlertCircle className="h-3.5 w-3.5 text-destructive-text" />
                                  )}
                                  <span className="font-mono text-micro text-muted-foreground">
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
                                  title={t.review.removeExercise}
                                  aria-label={t.review.removeExercise}
                                  onClick={() => removeExercise(workoutIdx, exerciseIdx)}
                                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive-text"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>

                                {/* Mobile summary (shown instead of fields) */}
                                <div className="flex flex-wrap gap-x-3 gap-y-1 md:hidden">
                                  <MobileField label={t.review.columns.sets} value={ex.sets} placeholder="3"
                                    onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { sets: v })} />
                                  <MobileField label={t.review.columns.reps} value={ex.reps} placeholder="8-12"
                                    onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { reps: v })} />
                                  <MobileField label={t.review.columns.kg} value={ex.weight} placeholder="—"
                                    onChange={(v) => updateExercise(workoutIdx, exerciseIdx, { weight: v })} />
                                  <MobileField label={t.review.columns.rir} value={ex.rir} placeholder="—"
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
                {didOverwrite ? t.done.overwritten(savedName) : t.done.created(savedName)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {didOverwrite ? t.done.overwrittenHelp : t.done.createdHelp}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-[68px] shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-8">
          <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">{step === "review" ? fileName : ""}</p>
          <div className="flex shrink-0 gap-2">
            {step === "upload" ? (
              <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                {t.actions.cancel}
              </Button>
            ) : null}
            {step === "review" ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setStep("upload")} disabled={isSaving}>
                  <ArrowLeft className="h-4 w-4" />
                  {t.actions.back}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={!payload || Boolean(error) || isSaving || !authenticated}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {isSaving ? t.actions.creating : t.actions.create}
                </Button>
              </>
            ) : null}
            {step === "done" ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t.actions.finish}
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
      <span className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
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
    <div className="grid gap-1.5 bg-card p-2.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt>
        <code className="inline-block rounded-md bg-surface-subtle px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
          {name}
        </code>
      </dt>
      <dd className="text-sm text-muted-foreground">{columns}</dd>
    </div>
  )
}
