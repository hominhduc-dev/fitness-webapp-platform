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
import { WorkoutLogsPreview } from "@/components/workout/workout-logs-preview"
import { fetchWorkoutLogsForExport } from "@/lib/fitness/api"
import { formatDateToISO, getProgramStartDate } from "@/lib/fitness/date-range"
import type { TraineeProgram } from "@/lib/fitness/types"
import type { WorkoutLog } from "@/lib/types"

type ExportMode = "week" | "program"

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return formatDateToISO(d)
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() + days)
  return formatDateToISO(d)
}

type ExportWorkoutDialogProps = {
  programs?: TraineeProgram[]
}

export function ExportWorkoutDialog({ programs = [] }: ExportWorkoutDialogProps) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ExportMode>("week")
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [selectedProgramId, setSelectedProgramId] = useState<string>("")
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewLogs, setPreviewLogs] = useState<WorkoutLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedProgram = programs.find((p) => p.id === selectedProgramId)

  // Drop any stale preview when the selected range changes.
  useEffect(() => {
    setPreviewLogs(null)
  }, [mode, weekStart, selectedProgramId])

  const resolveRange = (): { from: string; to: string; label: string } | null => {
    if (mode === "week") {
      return { from: weekStart, label: `week-${weekStart}`, to: addDays(weekStart, 7) }
    }
    if (!selectedProgram) {
      setError("Chọn một program để export.")
      return null
    }
    const startDate = getProgramStartDate(selectedProgram.assignedAt, selectedProgram.duration)
    const from = formatDateToISO(startDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + selectedProgram.duration * 7)
    // Tomorrow as upper bound so today's logs are included (query uses `lt`)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const to = formatDateToISO(endDate < tomorrow ? endDate : tomorrow)
    return { from, label: selectedProgram.name, to }
  }

  const handlePreview = async () => {
    if (!session?.access_token || isLoadingPreview) return
    setError(null)
    const range = resolveRange()
    if (!range) return

    setIsLoadingPreview(true)
    try {
      const logs = await fetchWorkoutLogsForExport(session.access_token, { from: range.from, to: range.to })
      if (logs.length === 0) {
        setPreviewLogs(null)
        setError("Không có buổi tập nào trong khoảng thời gian này.")
        return
      }
      setPreviewLogs(logs)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải preview. Thử lại sau.")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleExport = async () => {
    if (!session?.access_token || isExporting) return
    setIsExporting(true)
    setError(null)

    try {
      const range = resolveRange()
      if (!range) {
        setIsExporting(false)
        return
      }

      // Reuse already-fetched preview logs when available (preview is cleared
      // whenever the range changes, so it's always in sync).
      const logs = previewLogs ?? (await fetchWorkoutLogsForExport(session.access_token, { from: range.from, to: range.to }))

      if (logs.length === 0) {
        setError("Không có buổi tập nào trong khoảng thời gian này.")
        setIsExporting(false)
        return
      }

      const { downloadWorkoutLogs } = await import("@/components/workout-export-excel")
      await downloadWorkoutLogs(logs, { from: range.from, label: range.label, to: range.to })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể export. Thử lại sau.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setPreviewLogs(null)
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>

      <DialogContent className={previewLogs ? "w-full max-w-md" : "w-full max-w-sm"}>
        <DialogHeader>
          <DialogTitle>Export dữ liệu tập luyện</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-5">
          {/* Mode picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Lọc theo</Label>
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
                  {m === "week" ? "Theo tuần" : "Theo program"}
                </button>
              ))}
            </div>
          </div>

          {/* Week picker */}
          {mode === "week" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="week-start" className="text-xs text-muted-foreground">
                Tuần bắt đầu (chủ nhật)
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
                Export từ {weekStart} đến {addDays(weekStart, 7)}
              </p>
            </div>
          )}

          {/* Program picker */}
          {mode === "program" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="program-select" className="text-xs text-muted-foreground">
                Program
              </Label>
              {programs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bạn chưa được gán program nào.</p>
              ) : (
                <select
                  id="program-select"
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Chọn program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.duration} tuần)
                    </option>
                  ))}
                </select>
              )}
              {selectedProgram && (
                <p className="text-xs text-muted-foreground">
                  Từ {formatDateToISO(getProgramStartDate(selectedProgram.assignedAt, selectedProgram.duration))} · {selectedProgram.duration} tuần
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {previewLogs ? (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Xem trước</Label>
              <WorkoutLogsPreview logs={previewLogs} />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => void handlePreview()}
              disabled={isLoadingPreview || isExporting || (mode === "program" && !selectedProgramId)}
              className="w-full gap-2"
            >
              {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {isLoadingPreview ? "Đang tải..." : previewLogs ? "Tải lại preview" : "Xem trước"}
            </Button>

            <Button
              onClick={() => void handleExport()}
              disabled={isExporting || (mode === "program" && !selectedProgramId)}
              className="w-full gap-2"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? "Đang tạo file..." : "Tải xuống Excel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
