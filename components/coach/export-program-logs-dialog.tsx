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
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { WorkoutLogsPreview } from "@/components/workout/workout-logs-preview"
import { exportCoachWorkoutLogsToGoogleSheets, fetchCoachWorkoutLogs } from "@/lib/fitness/api"
import { formatDateToISO, formatDisplayDate, getProgramStartDate } from "@/lib/fitness/date-range"
import type { AssignedTrainee } from "@/lib/fitness/types"
import type { WorkoutLog } from "@/lib/types"

type ExportMode = "week" | "program"

// Local YYYY-MM-DD (not UTC) so week boundaries match the user's timezone.
function toLocalISODate(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  // Snap back to Monday. getDay() is 0 (Sun)..6 (Sat); days since Monday = (day + 6) % 7.
  const daysSinceMonday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - daysSinceMonday)
  return toLocalISODate(d)
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toLocalISODate(d)
}

type ExportProgramLogsDialogProps = {
  assignedTrainees: AssignedTrainee[]
  programDuration: number
  programId: string
  programName: string
}

async function loadAllLogs(
  accessToken: string,
  traineeId: string,
  range: { from: string; programId?: string; to: string },
) {
  const allLogs: Awaited<ReturnType<typeof fetchCoachWorkoutLogs>>["logs"] = []
  let cursor: string | undefined

  for (let page = 0; page < 20; page++) {
    const result = await fetchCoachWorkoutLogs(accessToken, traineeId, {
      cursor,
      from: range.from,
      limit: 50,
      programId: range.programId,
      to: range.to,
    })
    allLogs.push(...result.logs)

    if (!result.nextCursor) break
    cursor = result.nextCursor
  }

  return allLogs
}

export function ExportProgramLogsDialog({
  assignedTrainees,
  programDuration,
  programId,
  programName,
}: ExportProgramLogsDialogProps) {
  const { session } = useAuth()
  const { messages } = useLocale()
  const [open, setOpen] = useState(false)
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("")
  const [mode, setMode] = useState<ExportMode>("program")
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingToSheets, setIsExportingToSheets] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewLogs, setPreviewLogs] = useState<WorkoutLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedTrainee = assignedTrainees.find((t) => t.id === selectedTraineeId)

  // Drop any stale preview when the selected trainee or range changes.
  useEffect(() => {
    setPreviewLogs(null)
  }, [selectedTraineeId, mode, weekStart])

  const getProgramRange = (trainee: AssignedTrainee) => {
    const startDate = getProgramStartDate(trainee.assignedAt, programDuration)
    const from = formatDateToISO(startDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + programDuration * 7)
    // Use tomorrow as upper bound so today's logs are included (query uses `lt`)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const to = formatDateToISO(endDate < tomorrow ? endDate : tomorrow)
    return { from, to }
  }

  // Resolve the active export range based on the selected mode.
  // Week mode mirrors the trainee export: a Monday-based 7-day window across
  // all of the trainee's workouts (no program filter). Program mode keeps the
  // existing behavior of exporting the whole assigned program.
  const resolveRange = (
    trainee: AssignedTrainee,
  ): { from: string; label: string; programId?: string; to: string } => {
    if (mode === "week") {
      return { from: weekStart, label: `week-${weekStart}`, to: addDays(weekStart, 7) }
    }
    const { from, to } = getProgramRange(trainee)
    return { from, label: programName, programId, to }
  }

  const emptyMessage = () =>
    mode === "week" ? messages.workoutPage.exportEmptyRange : messages.workoutPage.exportTraineeEmptyProgram

  const handlePreview = async () => {
    if (!session?.access_token || isLoadingPreview || !selectedTrainee) return
    setError(null)
    setNotice(null)
    setIsLoadingPreview(true)
    try {
      const range = resolveRange(selectedTrainee)
      const logs = await loadAllLogs(session.access_token, selectedTrainee.id, range)
      if (logs.length === 0) {
        setPreviewLogs(null)
        setError(emptyMessage())
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
    if (!session?.access_token || isExporting || !selectedTrainee) return
    setIsExporting(true)
    setError(null)
    setNotice(null)

    try {
      const range = resolveRange(selectedTrainee)
      // Reuse already-fetched preview logs when available (cleared on range change).
      const logs = previewLogs ?? (await loadAllLogs(session.access_token, selectedTrainee.id, range))

      if (logs.length === 0) {
        setError(emptyMessage())
        setIsExporting(false)
        return
      }

      const { downloadWorkoutLogs } = await import("@/components/workout-export-excel")
      await downloadWorkoutLogs(logs, {
        from: range.from,
        label: range.label,
        subjectName: selectedTrainee.name,
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
    if (!session?.access_token || isExportingToSheets || !selectedTrainee) return
    setIsExportingToSheets(true)
    setError(null)
    setNotice(null)

    try {
      const range = resolveRange(selectedTrainee)
      const result = await exportCoachWorkoutLogsToGoogleSheets(session.access_token, selectedTrainee.id, {
        from: range.from,
        label: range.label,
        programId: range.programId,
        to: range.to,
      })

      setNotice(`Exported ${result.logCount} workout logs (${result.rowCount} rows) to Google Sheets.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể export logs sang Google Sheets.")
    } finally {
      setIsExportingToSheets(false)
    }
  }

  if (assignedTrainees.length === 0) return null

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
          {messages.workoutPage.exportLogs}
        </Button>
      </DialogTrigger>

      <DialogContent className={previewLogs ? "w-full max-w-md" : "w-full max-w-sm"}>
        <DialogHeader>
          <DialogTitle>{messages.workoutPage.exportLogs} - {programName}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-5">
          {/* Trainee picker */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="trainee-select" className="text-xs text-muted-foreground">
              {messages.workoutPage.exportSelectTrainee}
            </Label>
            <select
              id="trainee-select"
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{messages.workoutPage.exportSelectTraineePlaceholder}</option>
              {assignedTrainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          {/* Mode picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">{messages.workoutPage.exportFilterBy}</Label>
            <div className="flex gap-2">
              {(["week", "program"] as ExportMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    mode === m
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m === "week" ? messages.workoutPage.exportWeek : messages.workoutPage.exportProgram}
                </button>
              ))}
            </div>
          </div>

          {/* Week picker */}
          {mode === "week" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="week-start" className="text-xs text-muted-foreground">
                {messages.workoutPage.exportWeekStarts}
              </Label>
              <input
                id="week-start"
                type="date"
                value={weekStart}
                onChange={(e) => {
                  const val = e.target.value
                  if (val) setWeekStart(getWeekStart(new Date(`${val}T00:00:00`)))
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {messages.workoutPage.exportFromTo(formatDisplayDate(weekStart), formatDisplayDate(addDays(weekStart, 7)))}
              </p>
            </div>
          )}

          {/* Program summary */}
          {mode === "program" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                {messages.workoutPage.exportProgramSummary(programDuration)}
              </p>
              {selectedTrainee && (
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const { from, to } = getProgramRange(selectedTrainee)
                    return messages.workoutPage.exportProgramRange(formatDisplayDate(from), formatDisplayDate(to))
                  })()}
                </p>
              )}
            </div>
          )}

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
              disabled={isLoadingPreview || isExporting || !selectedTraineeId}
              className="w-full gap-2"
            >
              {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {isLoadingPreview ? messages.workoutPage.exportLoading : previewLogs ? messages.workoutPage.exportReloadPreview : messages.workoutPage.exportPreview}
            </Button>

            <Button
              onClick={() => void handleExport()}
              disabled={isExporting || isExportingToSheets || !selectedTraineeId}
              className="w-full gap-2"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? messages.workoutPage.generatingFile : messages.workoutPage.exportDownloadExcel}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleExportGoogleSheets()}
              disabled={isExporting || isExportingToSheets || !selectedTraineeId}
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
