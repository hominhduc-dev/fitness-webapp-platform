"use client"

import { useMemo, useState, type ChangeEvent } from "react"
import { Download, Loader2, Upload } from "lucide-react"

import { AdminExercisesPanel, type ExerciseSaveData } from "@/components/admin/admin-exercises-panel"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
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
  const { locale, messages } = useLocale()
  const copy = {
    downloadTemplateError: locale === "en" ? "Unable to create template file." : "Không thể tạo file mẫu.",
    emptyFile: locale === "en" ? "Selected file is empty." : "File được chọn đang trống.",
    missingColumns: (columns: string) =>
      locale === "en" ? `Missing required columns: ${columns}.` : `Thiếu cột bắt buộc: ${columns}.`,
    missingExerciseRow:
      locale === "en" ? "Missing exercise_name or muscle_group." : "Thiếu exercise_name hoặc muscle_group.",
    noRows: locale === "en" ? "No exercise rows found in this file." : "Không tìm thấy dòng bài tập nào trong file.",
    readFileError: locale === "en" ? "Unable to read selected file." : "Không thể đọc file đã chọn.",
    importSubmitted: (count: number) =>
      locale === "en"
        ? `Submitted ${count} exercise rows for admin approval. Data has not been inserted into the database yet.`
        : `Đã gửi ${count} dòng bài tập để admin duyệt. Dữ liệu chưa được insert vào DB.`,
    submitImportError: locale === "en" ? "Unable to submit import request." : "Không thể gửi yêu cầu import.",
    exerciseUpdated: locale === "en" ? "Personal exercise updated." : "Đã cập nhật bài tập cá nhân.",
    exerciseCreated: locale === "en" ? "Personal exercise created." : "Đã tạo bài tập cá nhân.",
    saveExerciseError: locale === "en" ? "Unable to save personal exercise." : "Không thể lưu bài tập cá nhân.",
    exerciseDeleted: locale === "en" ? "Personal exercise deleted." : "Đã xoá bài tập cá nhân.",
    deleteExerciseError: locale === "en" ? "Unable to delete this exercise." : "Không thể xoá bài tập này.",
    pendingApproval: locale === "en" ? "Pending admin approval" : "Đang chờ admin duyệt",
    pendingRequestCount: (count: number) =>
      locale === "en"
        ? `${count} Excel import request${count === 1 ? "" : "s"} pending admin approval.`
        : `${count} yêu cầu import Excel đang chờ admin duyệt.`,
    importTitle: locale === "en" ? "Submit exercise import for admin approval" : "Gửi import bài tập để admin duyệt",
    importDescription:
      locale === "en"
        ? "The Excel file will be saved as a pending request. Exercises are inserted only after an admin approves it."
        : "File Excel sẽ được lưu thành yêu cầu chờ duyệt. Chỉ sau khi admin approve thì bài tập mới được insert vào DB.",
    selectFile: locale === "en" ? "Select file" : "Chọn file",
    importHelp:
      locale === "en"
        ? "Required: exercise_name, muscle_group. Optional: variation_name, equipment, is_default, sort_order."
        : "Bắt buộc: exercise_name, muscle_group. Có thể thêm variation_name, equipment, is_default, sort_order.",
    downloadExcelTemplate: locale === "en" ? "Download Excel template" : "Tải file mẫu Excel",
    file: "File",
    validRows: locale === "en" ? "Valid rows" : "Dòng hợp lệ",
    issues: locale === "en" ? "Issues" : "Lỗi",
    readingFile: locale === "en" ? "Reading file..." : "Đang đọc file...",
    validationIssues: locale === "en" ? "Validation issues" : "Lỗi cần sửa",
    rowPrefix: (row: number) => (locale === "en" ? `Row ${row}: ` : `Dòng ${row}: `),
    preview: locale === "en" ? "Preview" : "Xem trước",
    previewDescription:
      locale === "en"
        ? "The rows below will be sent for admin approval and will not create exercises immediately."
        : "Các dòng dưới đây sẽ được gửi để admin duyệt, chưa tạo bài tập ngay.",
    row: locale === "en" ? "Row" : "Dòng",
    exercise: locale === "en" ? "Exercise" : "Bài tập",
    muscleGroup: locale === "en" ? "Muscle group" : "Nhóm cơ",
    variation: "Variation",
    equipment: locale === "en" ? "Equipment" : "Thiết bị",
    noEquipment: locale === "en" ? "No equipment" : "Không có thiết bị",
    submitForApproval: locale === "en" ? "Submit for approval" : "Gửi admin duyệt",
  }
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
      setError(downloadError instanceof Error ? downloadError.message : copy.downloadTemplateError)
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
        throw new Error(copy.emptyFile)
      }

      const { columnMap, rows } = worksheet
      const missingColumns = [
        typeof columnMap.exerciseName !== "number" ? "exercise_name" : null,
        typeof columnMap.muscleGroup !== "number" ? "muscle_group" : null,
      ].filter(Boolean)

      if (missingColumns.length > 0) {
        throw new Error(copy.missingColumns(missingColumns.join(", ")))
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
          nextIssues.push({ message: copy.missingExerciseRow, rowNumber })
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
        nextIssues.push({ message: copy.noRows })
      }

      setImportFileName(file.name)
      setImportRows(nextRows)
      setImportIssues(nextIssues)
    } catch (importError) {
      setImportFileName(file.name)
      setImportRows([])
      setImportIssues([{ message: importError instanceof Error ? importError.message : copy.readFileError }])
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
      setNotice(copy.importSubmitted(request.rowCount))
      setIsImportDialogOpen(false)
      resetImportState()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.submitImportError)
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
      setNotice(data.id ? copy.exerciseUpdated : copy.exerciseCreated)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveExerciseError)
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
      setNotice(copy.exerciseDeleted)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : copy.deleteExerciseError)
      throw deleteError
    } finally {
      setActionKey(null)
    }
  }

  const pendingImportRequests = importRequests.filter((request) => request.status === "pending")

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-[10px] border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-[10px] border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      ) : null}
      {pendingImportRequests.length > 0 ? (
        <div className="rounded-[10px] border border-border bg-card px-4 py-3">
          <p className="label-micro text-muted-foreground">{copy.pendingApproval}</p>
          <p className="mt-1 text-sm text-foreground">
            {copy.pendingRequestCount(pendingImportRequests.length)}
          </p>
        </div>
      ) : null}

      <AdminExercisesPanel
        actionKey={actionKey}
        exercises={panelExercises}
        locale={locale}
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
            <DialogTitle>{copy.importTitle}</DialogTitle>
            <DialogDescription>
              {copy.importDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[10px] border border-dashed border-border bg-muted/20 p-4">
              <Label htmlFor="coach-exercise-import-file">{copy.selectFile}</Label>
              <Input
                key={importInputKey}
                id="coach-exercise-import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-2"
                onChange={(event) => void handleImportFileChange(event)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.importHelp}
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
                {copy.downloadExcelTemplate}
              </Button>
            </div>

            {importFileName ? (
              <div className="grid gap-3 rounded-[10px] border border-border bg-card p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.file}</p>
                  <p className="mt-1 truncate text-sm font-medium">{importFileName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.validRows}</p>
                  <p className="mt-1 text-sm font-medium">{importRows.length}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{copy.issues}</p>
                  <p className="mt-1 text-sm font-medium">{importIssues.length}</p>
                </div>
              </div>
            ) : null}

            {actionKey === "exercise-import-parse" ? (
              <div className="flex items-center gap-2 rounded-[10px] border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{copy.readingFile}</span>
              </div>
            ) : null}

            {importIssues.length ? (
              <div className="rounded-[10px] border border-destructive/30 bg-destructive-soft p-4">
                <h4 className="text-sm font-semibold">{copy.validationIssues}</h4>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {importIssues.slice(0, 8).map((issue, index) => (
                    <p key={`${issue.rowNumber ?? "general"}-${index}`}>
                      {issue.rowNumber ? copy.rowPrefix(issue.rowNumber) : ""}
                      {issue.message}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {importRows.length ? (
              <div className="rounded-[10px] border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h4 className="text-sm font-semibold">{copy.preview}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {copy.previewDescription}
                  </p>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">{copy.row}</th>
                        <th className="px-4 py-2">{copy.exercise}</th>
                        <th className="px-4 py-2">{copy.muscleGroup}</th>
                        <th className="px-4 py-2">{copy.variation}</th>
                        <th className="px-4 py-2">{copy.equipment}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 8).map((row) => (
                        <tr key={`${row.rowNumber}-${row.exerciseName}-${row.variationName}`} className="border-t border-border">
                          <td className="px-4 py-2 text-muted-foreground">{row.rowNumber}</td>
                          <td className="px-4 py-2 font-medium">{row.exerciseName}</td>
                          <td className="px-4 py-2">{row.muscleGroup}</td>
                          <td className="px-4 py-2">{row.variationName}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.equipment ?? copy.noEquipment}</td>
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
              {messages.common.cancel}
            </Button>
            <Button onClick={() => void handleSubmitImportRequest()} disabled={actionKey === "exercise-import" || !importRows.length || importIssues.length > 0}>
              {actionKey === "exercise-import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {copy.submitForApproval}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
