"use client"

import { useEffect, useState } from "react"
import { Download, Eye, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useLocale } from "@/components/providers/locale-provider"
import { WorkoutLogsPreview } from "@/components/workout/workout-logs-preview"
import type { PlannedSession } from "@/components/workout-export-excel"
import { formatDisplayDate } from "@/lib/fitness/date-range"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"
import type { WorkoutLog } from "@/lib/types"

export type ExportMode = "week" | "program"

export type ResolvedExportRange = {
  from: string
  label: string
  /** When set, the Excel export splits into one "Week N" sheet per week with logs. */
  programStartDate?: string
  to: string
}

export type ExportSelection = {
  mode: ExportMode
  programId?: string
  subjectId?: string
  weekStart: string
}

export type ExportContext = ExportSelection & { range: ResolvedExportRange }

/** A selectable export subject (e.g. a trainee). Omit `subjects` for self-export. */
export type ExportSubject = {
  id: string
  /** Display text in the picker; falls back to `name`. */
  label?: string
  /** Plain name used for the export filename / "Client:" line. */
  name: string
}

export type ExportProgramOption = {
  id: string
  name: string
}

export type WorkoutExportDialogConfig = {
  defaultMode?: ExportMode
  description?: string
  dialogContentClassName?: string
  dialogOverlayClassName?: string
  exportToSheets: (context: ExportContext) => Promise<{ logCount: number; rowCount: number }>
  loadBodyMetrics?: (context: ExportContext) => Promise<BodyMetricEntry[]>
  loadLogs: (context: ExportContext) => Promise<WorkoutLog[]>
  /** Programs offered in the Program-mode picker. Omit when the program is fixed. */
  programs?: ExportProgramOption[]
  /** Resolve the date range for Program mode (Week mode is handled internally). */
  resolveProgramRange: (selection: ExportSelection) => ResolvedExportRange | { error: string }
  /**
   * Resolve the program's planned sessions (with calendar dates) for the Excel
   * export. Scheduled-but-unlogged days are then shown with blank actuals.
   */
  resolvePlannedSessions?: (selection: ExportSelection) => Promise<PlannedSession[]> | PlannedSession[]
  showProgramPicker?: boolean
  subjectPlaceholder?: string
  subjectSelectLabel?: string
  subjects?: ExportSubject[]
  title: string
  triggerLabel: string
}

// Local YYYY-MM-DD (not UTC) so week boundaries match the user's timezone.
function toLocalISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getWeekStart(date: Date) {
  const next = new Date(date)
  // Snap back to Monday. getDay() is 0 (Sun)..6 (Sat); days since Monday = (day + 6) % 7.
  const daysSinceMonday = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - daysSinceMonday)
  return toLocalISODate(next)
}

function addDays(isoDate: string, days: number) {
  const next = new Date(`${isoDate}T00:00:00`)
  next.setDate(next.getDate() + days)
  return toLocalISODate(next)
}

export function WorkoutExportDialog(config: WorkoutExportDialogConfig) {
  const { messages } = useLocale()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ExportMode>(config.defaultMode ?? "week")
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [subjectId, setSubjectId] = useState<string>("")
  const [programId, setProgramId] = useState<string>("")
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingToSheets, setIsExportingToSheets] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewLogs, setPreviewLogs] = useState<WorkoutLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedSubject = config.subjects?.find((subject) => subject.id === subjectId)

  // Drop any stale preview when the selected range changes.
  useEffect(() => {
    setPreviewLogs(null)
  }, [mode, weekStart, subjectId, programId])

  const selection: ExportSelection = { mode, programId: programId || undefined, subjectId: subjectId || undefined, weekStart }

  const resolveRange = (): ResolvedExportRange | { error: string } => {
    if (mode === "week") {
      return { from: weekStart, label: `week-${weekStart}`, to: addDays(weekStart, 7) }
    }
    return config.resolveProgramRange(selection)
  }

  const resolved = resolveRange()
  const hasRangeError = "error" in resolved
  const needsSubject = Boolean(config.subjects) && !subjectId
  const actionsDisabled = needsSubject || hasRangeError

  const handlePreview = async () => {
    if (isLoadingPreview || actionsDisabled) return
    setError(null)
    setNotice(null)

    const range = resolveRange()
    if ("error" in range) {
      setError(range.error)
      return
    }

    setIsLoadingPreview(true)
    try {
      const logs = await config.loadLogs({ ...selection, range })
      if (logs.length === 0) {
        setPreviewLogs(null)
        setError(messages.workoutPage.exportEmptyRange)
        return
      }
      setPreviewLogs(logs)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.workoutPage.exportPreviewFailed)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleExport = async () => {
    if (isExporting || actionsDisabled) return
    setError(null)
    setNotice(null)

    const range = resolveRange()
    if ("error" in range) {
      setError(range.error)
      return
    }

    setIsExporting(true)
    try {
      // Reuse already-fetched preview logs when available (cleared on range change).
      const logs = previewLogs ?? (await config.loadLogs({ ...selection, range }))
      if (logs.length === 0) {
        setError(messages.workoutPage.exportEmptyRange)
        return
      }

      const plannedSessions = config.resolvePlannedSessions
        ? await config.resolvePlannedSessions(selection)
        : undefined
      const bodyMetrics = config.loadBodyMetrics
        ? await config.loadBodyMetrics({ ...selection, range })
        : undefined

      const { downloadWorkoutLogs } = await import("@/components/workout-export-excel")
      await downloadWorkoutLogs(logs, {
        bodyMetrics,
        from: range.from,
        label: range.label,
        plannedSessions,
        programStartDate: range.programStartDate,
        subjectName: selectedSubject?.name,
        to: range.to,
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.workoutPage.exportFailed)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportGoogleSheets = async () => {
    if (isExportingToSheets || actionsDisabled) return
    setError(null)
    setNotice(null)

    const range = resolveRange()
    if ("error" in range) {
      setError(range.error)
      return
    }

    setIsExportingToSheets(true)
    try {
      const result = await config.exportToSheets({ ...selection, range })
      setNotice(`Exported ${result.logCount} workout logs (${result.rowCount} rows) to Google Sheets.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể export workout logs sang Google Sheets.")
    } finally {
      setIsExportingToSheets(false)
    }
  }

  const showNoPrograms = mode === "program" && config.showProgramPicker && (config.programs?.length ?? 0) === 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setPreviewLogs(null)
          setError(null)
          setNotice(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          {config.triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent
        overlayClassName={config.dialogOverlayClassName}
        className={cn(previewLogs ? "w-full max-w-md" : "w-full max-w-sm", config.dialogContentClassName)}
      >
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-5">
          {config.description ? (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          ) : null}

          {/* Subject (trainee) picker */}
          {config.subjects ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="export-subject" className="text-xs text-muted-foreground">
                {config.subjectSelectLabel}
              </Label>
              <select
                id="export-subject"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{config.subjectPlaceholder}</option>
                {config.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.label ?? subject.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Mode picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">{messages.workoutPage.exportFilterBy}</Label>
            <div className="flex gap-2">
              {(["week", "program"] as ExportMode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    mode === value
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {value === "week" ? messages.workoutPage.exportWeek : messages.workoutPage.exportProgram}
                </button>
              ))}
            </div>
          </div>

          {/* Week picker */}
          {mode === "week" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="export-week-start" className="text-xs text-muted-foreground">
                {messages.workoutPage.exportWeekStarts}
              </Label>
              <input
                id="export-week-start"
                type="date"
                value={weekStart}
                onChange={(event) => {
                  const value = event.target.value
                  if (value) setWeekStart(getWeekStart(new Date(`${value}T00:00:00`)))
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {messages.workoutPage.exportFromTo(formatDisplayDate(weekStart), formatDisplayDate(addDays(weekStart, 7)))}
              </p>
            </div>
          ) : null}

          {/* Program picker (only when a list of programs is offered) */}
          {mode === "program" && config.showProgramPicker ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="export-program" className="text-xs text-muted-foreground">
                Program
              </Label>
              {showNoPrograms ? (
                <p className="text-sm text-muted-foreground">{messages.workoutPage.noAssignedPrograms}</p>
              ) : (
                <select
                  id="export-program"
                  value={programId}
                  onChange={(event) => setProgramId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{messages.workoutPage.exportSelectProgram}</option>
                  {config.programs?.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {/* Resolved range hint */}
          {!hasRangeError && mode === "program" ? (
            <p className="text-xs text-muted-foreground">
              {messages.workoutPage.exportFromTo(formatDisplayDate(resolved.from), formatDisplayDate(resolved.to))}
            </p>
          ) : null}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="text-sm text-primary">{notice}</p>}

          {previewLogs ? (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">{messages.workoutPage.exportPreview}</Label>
              <WorkoutLogsPreview logs={previewLogs} />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => void handlePreview()}
              disabled={isLoadingPreview || isExporting || actionsDisabled}
              className="w-full gap-2"
            >
              {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {isLoadingPreview
                ? messages.workoutPage.exportLoading
                : previewLogs
                  ? messages.workoutPage.exportReloadPreview
                  : messages.workoutPage.exportPreview}
            </Button>

            <Button
              onClick={() => void handleExport()}
              disabled={isExporting || isExportingToSheets || actionsDisabled}
              className="w-full gap-2"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? messages.workoutPage.generatingFile : messages.workoutPage.exportDownloadExcel}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExportGoogleSheets()}
              disabled={isExporting || isExportingToSheets || actionsDisabled}
              className="w-full gap-2"
            >
              {isExportingToSheets ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExportingToSheets ? "Exporting to Google Sheets..." : "Export to Google Sheets"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
