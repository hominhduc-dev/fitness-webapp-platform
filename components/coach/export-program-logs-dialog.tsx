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
import { fetchCoachWorkoutLogs } from "@/lib/fitness/api"
import { formatDateToISO, formatDisplayDate, getProgramStartDate } from "@/lib/fitness/date-range"
import type { AssignedTrainee } from "@/lib/fitness/types"
import type { WorkoutLog } from "@/lib/types"

type ExportProgramLogsDialogProps = {
  assignedTrainees: AssignedTrainee[]
  programDuration: number
  programName: string
}

async function loadAllLogsForProgramExport(
  accessToken: string,
  traineeId: string,
  from: string,
  to: string,
) {
  const allLogs: Awaited<ReturnType<typeof fetchCoachWorkoutLogs>>["logs"] = []
  let cursor: string | undefined

  for (let page = 0; page < 20; page++) {
    const result = await fetchCoachWorkoutLogs(accessToken, traineeId, {
      cursor,
      from,
      limit: 50,
      to,
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
  programName,
}: ExportProgramLogsDialogProps) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("")
  const [isExporting, setIsExporting] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewLogs, setPreviewLogs] = useState<WorkoutLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedTrainee = assignedTrainees.find((t) => t.id === selectedTraineeId)

  // Drop any stale preview when the selected trainee changes.
  useEffect(() => {
    setPreviewLogs(null)
  }, [selectedTraineeId])

  const getDateRange = (trainee: AssignedTrainee) => {
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

  const handlePreview = async () => {
    if (!session?.access_token || isLoadingPreview || !selectedTrainee) return
    setError(null)
    setIsLoadingPreview(true)
    try {
      const { from, to } = getDateRange(selectedTrainee)
      const logs = await loadAllLogsForProgramExport(session.access_token, selectedTrainee.id, from, to)
      if (logs.length === 0) {
        setPreviewLogs(null)
        setError("Trainee này chưa có buổi tập nào trong program.")
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
    if (!session?.access_token || isExporting || !selectedTrainee) return
    setIsExporting(true)
    setError(null)

    try {
      const { from, to } = getDateRange(selectedTrainee)
      // Reuse already-fetched preview logs when available (cleared on trainee change).
      const logs = previewLogs ?? (await loadAllLogsForProgramExport(session.access_token, selectedTrainee.id, from, to))

      if (logs.length === 0) {
        setError("Trainee này chưa có buổi tập nào trong program.")
        setIsExporting(false)
        return
      }

      const { downloadWorkoutLogs } = await import("@/components/workout-export-excel")
      await downloadWorkoutLogs(logs, {
        from,
        label: programName,
        subjectName: selectedTrainee.name,
        to,
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể export. Thử lại sau.")
    } finally {
      setIsExporting(false)
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
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export logs
        </Button>
      </DialogTrigger>

      <DialogContent className={previewLogs ? "w-full max-w-md" : "w-full max-w-sm"}>
        <DialogHeader>
          <DialogTitle>Export logs — {programName}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">
            Export tất cả buổi tập của trainee trong suốt thời gian program ({programDuration} tuần).
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="trainee-select" className="text-xs text-muted-foreground">
              Chọn trainee
            </Label>
            <select
              id="trainee-select"
              value={selectedTraineeId}
              onChange={(e) => setSelectedTraineeId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Chọn trainee...</option>
              {assignedTrainees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
            {selectedTrainee && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const { from, to } = getDateRange(selectedTrainee)
                  return `Khoảng thời gian: ${formatDisplayDate(from)} → ${formatDisplayDate(to)}`
                })()}
              </p>
            )}
          </div>

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
              disabled={isLoadingPreview || isExporting || !selectedTraineeId}
              className="w-full gap-2"
            >
              {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {isLoadingPreview ? "Đang tải..." : previewLogs ? "Tải lại preview" : "Xem trước"}
            </Button>

            <Button
              onClick={() => void handleExport()}
              disabled={isExporting || !selectedTraineeId}
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
