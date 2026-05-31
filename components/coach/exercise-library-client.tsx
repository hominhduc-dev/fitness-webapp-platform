"use client"

import { useMemo, useState, type ChangeEvent } from "react"
import { Download, Loader2, Upload } from "lucide-react"

import { AdminExercisesPanel, type ExerciseSaveData } from "@/components/admin/admin-exercises-panel"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createCoachExerciseRequest,
  deleteCoachExerciseRequest,
  submitCoachExerciseImportRequest,
  updateCoachExerciseRequest,
} from "@/lib/fitness/api"
import type { AdminExerciseItem, AdminExerciseImportRow } from "@/lib/admin/types"
import type { CoachExercise, CoachExerciseImportRequest } from "@/lib/fitness/types"

type ExerciseLibraryClientProps = {
  initialExercises: CoachExercise[]
  initialImportRequests: CoachExerciseImportRequest[]
}

type ExerciseImportIssue = {
  message: string
  rowNumber?: number
}

const EXERCISE_IMPORT_HEADERS = {
  exerciseName: ["exercise name", "exercise_name", "exercise", "name", "ten bai tap", "ten"],
  equipment: ["equipment", "gear", "device", "dung cu", "thiet bi"],
  isDefault: ["is default", "is_default", "default", "mac dinh"],
  muscleGroup: ["muscle group", "musclegroup", "muscle_group", "body part", "bodypart", "nhom co"],
  sortOrder: ["sort order", "sort_order", "order", "thu tu"],
  variationName: ["variation name", "variation_name", "variation", "bien the"],
} as const

const TEMPLATE_HEADERS = ["exercise_name", "muscle_group", "variation_name", "equipment", "is_default", "sort_order"]

function normalizeImportHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

function resolveImportColumn(value: unknown): keyof typeof EXERCISE_IMPORT_HEADERS | null {
  const normalizedValue = normalizeImportHeader(value)

  for (const [column, aliases] of Object.entries(EXERCISE_IMPORT_HEADERS) as ReadonlyArray<
    [keyof typeof EXERCISE_IMPORT_HEADERS, readonly string[]]
  >) {
    if (aliases.includes(normalizedValue)) {
      return column
    }
  }

  return null
}

function parseImportBoolean(value: unknown) {
  return ["1", "true", "yes", "y", "x"].includes(normalizeImportHeader(value))
}

function parseImportNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : undefined
}

function mapCoachExerciseToPanelItem(exercise: CoachExercise): AdminExerciseItem & { canManage: boolean } {
  return {
    canManage: exercise.canManage,
    createdAt: exercise.createdAt,
    createdBy: exercise.createdById
      ? {
          email: "",
          id: exercise.createdById,
          isActive: true,
          name: exercise.createdByName ?? "Coach",
          role: "coach",
        }
      : null,
    equipment: exercise.equipment,
    id: exercise.id,
    isDefault: exercise.variationName === "Default",
    muscleGroup: exercise.muscleGroup,
    name: exercise.name,
    updatedAt: exercise.updatedAt,
    usageCount: exercise.usageCount,
    variationName: exercise.variationName,
  }
}

function sortExercises(exercises: CoachExercise[]) {
  return exercises
    .slice()
    .sort((left, right) => left.muscleGroup.localeCompare(right.muscleGroup) || left.name.localeCompare(right.name))
}

export function ExerciseLibraryClient({ initialExercises, initialImportRequests }: ExerciseLibraryClientProps) {
  const { session } = useAuth()
  const [exercises, setExercises] = useState(sortExercises(initialExercises))
  const [importRequests, setImportRequests] = useState(initialImportRequests)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFileName, setImportFileName] = useState("")
  const [importRows, setImportRows] = useState<AdminExerciseImportRow[]>([])
  const [importIssues, setImportIssues] = useState<ExerciseImportIssue[]>([])
  const [importInputKey, setImportInputKey] = useState(0)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const panelExercises = useMemo(() => exercises.map(mapCoachExerciseToPanelItem), [exercises])

  function resetImportState() {
    setImportFileName("")
    setImportRows([])
    setImportIssues([])
    setImportInputKey((key) => key + 1)
  }

  async function handleDownloadExerciseTemplate() {
    setActionKey("exercise-template-download")
    setError(null)

    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.utils.book_new()
      const exercisesSheet = XLSX.utils.aoa_to_sheet([
        TEMPLATE_HEADERS,
        ["Tempo Hack Squat", "Legs", "Default", "Machine", "TRUE", 0],
        ["Cable Row", "Back", "Wide Grip", "Cable", "TRUE", 0],
      ])
      exercisesSheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(workbook, exercisesSheet, "Exercises")
      XLSX.writeFile(workbook, "coach-exercise-import-template.xlsx")
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Không thể tạo file mẫu.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setActionKey("exercise-import-parse")
    setError(null)
    setNotice(null)

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const worksheets = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<Array<string | number | null | undefined>>(sheet, {
          blankrows: false,
          defval: "",
          header: 1,
        })
        const header = rows[0] ?? []
        const columnMap = header.reduce<Partial<Record<keyof typeof EXERCISE_IMPORT_HEADERS, number>>>((result, cell, index) => {
          const column = resolveImportColumn(cell)
          if (column && typeof result[column] !== "number") result[column] = index
          return result
        }, {})
        return { columnMap, rows, sheetName }
      })
      const worksheet =
        worksheets.find((item) => item.sheetName.trim().toLowerCase() === "exercises") ??
        worksheets.find((item) => typeof item.columnMap.exerciseName === "number" && typeof item.columnMap.muscleGroup === "number")

      if (!worksheet || !worksheet.rows.length) {
        throw new Error("File được chọn đang trống.")
      }

      const { columnMap, rows } = worksheet
      const missingColumns = [
        typeof columnMap.exerciseName !== "number" ? "exercise_name" : null,
        typeof columnMap.muscleGroup !== "number" ? "muscle_group" : null,
      ].filter(Boolean)

      if (missingColumns.length > 0) {
        throw new Error(`Thiếu cột bắt buộc: ${missingColumns.join(", ")}.`)
      }

      const nextRows: AdminExerciseImportRow[] = []
      const nextIssues: ExerciseImportIssue[] = []

      rows.slice(1).forEach((row, index) => {
        const rowNumber = index + 2
        const exerciseName = String(row[columnMap.exerciseName as number] ?? "").trim()
        const muscleGroup = String(row[columnMap.muscleGroup as number] ?? "").trim()
        const variationNameIndex = columnMap.variationName
        const equipmentIndex = columnMap.equipment
        const isDefaultIndex = columnMap.isDefault
        const sortOrderIndex = columnMap.sortOrder
        const rawVariationName = typeof variationNameIndex === "number" ? String(row[variationNameIndex] ?? "").trim() : ""
        const variationName = rawVariationName || "Default"
        const equipment = typeof equipmentIndex === "number" ? String(row[equipmentIndex] ?? "").trim() : ""
        const isDefault = typeof isDefaultIndex === "number" ? parseImportBoolean(row[isDefaultIndex]) : variationName === "Default"
        const sortOrder = typeof sortOrderIndex === "number" ? parseImportNumber(row[sortOrderIndex]) : undefined
        const isBlankRow = !exerciseName && !muscleGroup && !rawVariationName && !equipment

        if (isBlankRow) return

        if (!exerciseName || !muscleGroup) {
          nextIssues.push({ message: "Thiếu exercise_name hoặc muscle_group.", rowNumber })
          return
        }

        nextRows.push({
          exerciseName,
          equipment: equipment || undefined,
          isDefault,
          muscleGroup,
          rowNumber,
          sortOrder,
          variationName,
        })
      })

      if (!nextRows.length && !nextIssues.length) {
        nextIssues.push({ message: "Không tìm thấy dòng bài tập nào trong file." })
      }

      setImportFileName(file.name)
      setImportRows(nextRows)
      setImportIssues(nextIssues)
    } catch (importError) {
      setImportFileName(file.name)
      setImportRows([])
      setImportIssues([{ message: importError instanceof Error ? importError.message : "Không thể đọc file đã chọn." }])
    } finally {
      setActionKey(null)
    }
  }

  async function handleSubmitImportRequest() {
    if (!session?.access_token || !importRows.length || importIssues.length > 0) return

    setActionKey("exercise-import")
    setError(null)
    setNotice(null)

    try {
      const request = await submitCoachExerciseImportRequest(session.access_token, {
        fileName: importFileName || undefined,
        rows: importRows,
      })
      setImportRequests((current) => [request, ...current])
      setNotice(`Đã gửi ${request.rowCount} dòng bài tập để admin duyệt. Dữ liệu chưa được insert vào DB.`)
      setIsImportDialogOpen(false)
      resetImportState()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể gửi yêu cầu import.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleSaveExercise(data: ExerciseSaveData) {
    if (!session?.access_token) return

    setActionKey(data.id ? `exercise-update-${data.id}` : "exercise-create")
    setError(null)
    setNotice(null)

    try {
      const payload = {
        equipment: data.equipment?.trim() || undefined,
        muscleGroup: data.muscleGroup.trim(),
        name: data.name.trim(),
      }
      const savedExercise = data.id
        ? await updateCoachExerciseRequest(session.access_token, data.id, payload)
        : await createCoachExerciseRequest(session.access_token, payload)

      setExercises((current) =>
        sortExercises(data.id ? current.map((exercise) => (exercise.id === savedExercise.id ? savedExercise : exercise)) : [savedExercise, ...current]),
      )
      setNotice(data.id ? "Đã cập nhật bài tập cá nhân." : "Đã tạo bài tập cá nhân.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu bài tập cá nhân.")
      throw saveError
    } finally {
      setActionKey(null)
    }
  }

  async function handleDeleteExercise(exercise: AdminExerciseItem) {
    if (!session?.access_token) return

    setActionKey(`exercise-delete-${exercise.id}`)
    setError(null)
    setNotice(null)

    try {
      await deleteCoachExerciseRequest(session.access_token, exercise.id)
      setExercises((current) => current.filter((item) => item.id !== exercise.id))
      setNotice("Đã xoá bài tập cá nhân.")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xoá bài tập này.")
      throw deleteError
    } finally {
      setActionKey(null)
    }
  }

  const pendingImportRequests = importRequests.filter((request) => request.status === "pending")

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-[10px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      ) : null}
      {pendingImportRequests.length > 0 ? (
        <div className="rounded-[10px] border border-border bg-card px-4 py-3">
          <p className="label-micro text-muted-foreground">Pending admin approval</p>
          <p className="mt-1 text-sm text-foreground">
            {pendingImportRequests.length} Excel import request{pendingImportRequests.length === 1 ? "" : "s"} đang chờ admin duyệt.
          </p>
        </div>
      ) : null}

      <AdminExercisesPanel
        actionKey={actionKey}
        exercises={panelExercises}
        locale="vi"
        onDelete={handleDeleteExercise}
        onDownloadTemplate={() => void handleDownloadExerciseTemplate()}
        onImport={() => setIsImportDialogOpen(true)}
        onSave={handleSaveExercise}
      />

      <Dialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open)
          if (!open) resetImportState()
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gửi import bài tập để admin duyệt</DialogTitle>
            <DialogDescription>
              File Excel sẽ được lưu thành yêu cầu chờ duyệt. Chỉ sau khi admin approve thì bài tập mới được insert vào DB.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[10px] border border-dashed border-border bg-muted/20 p-4">
              <Label htmlFor="coach-exercise-import-file">Chọn file</Label>
              <Input
                key={importInputKey}
                id="coach-exercise-import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-2"
                onChange={(event) => void handleImportFileChange(event)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Bắt buộc: exercise_name, muscle_group. Có thể thêm variation_name, equipment, is_default, sort_order.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 bg-transparent"
                onClick={() => void handleDownloadExerciseTemplate()}
                disabled={actionKey === "exercise-template-download"}
              >
                {actionKey === "exercise-template-download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Tải file mẫu Excel
              </Button>
            </div>

            {importFileName ? (
              <div className="grid gap-3 rounded-[10px] border border-border bg-card p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">File</p>
                  <p className="mt-1 truncate text-sm font-medium">{importFileName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Dòng hợp lệ</p>
                  <p className="mt-1 text-sm font-medium">{importRows.length}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Lỗi</p>
                  <p className="mt-1 text-sm font-medium">{importIssues.length}</p>
                </div>
              </div>
            ) : null}

            {actionKey === "exercise-import-parse" ? (
              <div className="flex items-center gap-2 rounded-[10px] border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang đọc file...</span>
              </div>
            ) : null}

            {importIssues.length ? (
              <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 p-4">
                <h4 className="text-sm font-semibold">Lỗi cần sửa</h4>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {importIssues.slice(0, 8).map((issue, index) => (
                    <p key={`${issue.rowNumber ?? "general"}-${index}`}>
                      {issue.rowNumber ? `Dòng ${issue.rowNumber}: ` : ""}
                      {issue.message}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {importRows.length ? (
              <div className="rounded-[10px] border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h4 className="text-sm font-semibold">Xem trước</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Các dòng dưới đây sẽ được gửi để admin duyệt, chưa tạo bài tập ngay.
                  </p>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">Dòng</th>
                        <th className="px-4 py-2">Bài tập</th>
                        <th className="px-4 py-2">Nhóm cơ</th>
                        <th className="px-4 py-2">Variation</th>
                        <th className="px-4 py-2">Thiết bị</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 8).map((row) => (
                        <tr key={`${row.rowNumber}-${row.exerciseName}-${row.variationName}`} className="border-t border-border">
                          <td className="px-4 py-2 text-muted-foreground">{row.rowNumber}</td>
                          <td className="px-4 py-2 font-medium">{row.exerciseName}</td>
                          <td className="px-4 py-2">{row.muscleGroup}</td>
                          <td className="px-4 py-2">{row.variationName}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.equipment ?? "Không có thiết bị"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={actionKey === "exercise-import"}>
              Huỷ
            </Button>
            <Button onClick={() => void handleSubmitImportRequest()} disabled={actionKey === "exercise-import" || !importRows.length || importIssues.length > 0}>
              {actionKey === "exercise-import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Gửi admin duyệt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
