"use client"

import {
  Activity,
  BarChart3,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  FileSpreadsheet,
  KeyRound,
  Link2,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  UserRoundCheck,
  Users,
} from "lucide-react"
import { useEffect, useState, type ChangeEvent } from "react"

import { StatsCard } from "@/components/dashboard/stats-card"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  assignAdminCoachConnection,
  createAdminExerciseRequest,
  deleteAdminCoachRequestRequest,
  deleteAdminExerciseRequest,
  deleteAdminProgramRequest,
  fetchAdminAuditLogs,
  fetchAdminCoachRequests,
  fetchAdminConnections,
  fetchAdminDashboard,
  fetchAdminExercises,
  fetchAdminPrograms,
  fetchAdminUserDetail,
  fetchAdminUsers,
  importAdminExercisesRequest,
  removeAdminCoachConnection,
  resetAdminUserPasswordRequest,
  updateAdminCoachRequestStatus,
  updateAdminExerciseRequest,
  updateAdminUserRequest,
} from "@/lib/admin/api"
import type {
  AdminAuditLogItem,
  AdminCoachRequest,
  AdminConnectionsData,
  AdminDashboardData,
  AdminExerciseItem,
  AdminExerciseImportRow,
  AdminMiniUser,
  AdminProgramSummary,
  AdminUserDetail,
  AdminUserListItem,
} from "@/lib/admin/types"
import type { UserRole } from "@/lib/types"

type ConfirmState =
  | {
      id: string
      kind: "connection" | "exercise" | "program" | "request"
      label: string
    }
  | null

type ExerciseFormState = {
  equipment: string
  id?: string
  muscleGroup: string
  name: string
}

type ExerciseImportIssue = {
  message: string
  rowNumber?: number
}

type ExerciseGroupItem = {
  exercises: AdminExerciseItem[]
  groupKey: string
  muscleGroup: string
  totalUsageCount: number
}

const EXERCISE_IMPORT_HEADERS = {
  equipment: ["equipment", "gear", "device", "dung cu", "thiet bi"],
  muscleGroup: ["muscle group", "musclegroup", "muscle_group", "body part", "bodypart", "nhom co"],
  name: ["name", "exercise", "exercise name", "exercise_name", "ten", "ten bai tap"],
} as const

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

function roleBadgeVariant(role: UserRole) {
  switch (role) {
    case "admin":
      return "default"
    case "coach":
      return "secondary"
    default:
      return "outline"
  }
}

function requestBadgeVariant(status: AdminCoachRequest["status"]) {
  switch (status) {
    case "approved":
      return "default"
    case "rejected":
      return "destructive"
    default:
      return "secondary"
  }
}

function matchesSearch(parts: Array<string | undefined | null>, query: string) {
  if (!query.trim()) {
    return true
  }

  const normalizedQuery = query.trim().toLowerCase()
  const digitQuery = query.replace(/\D/g, "")

  return parts.some((part) => {
    if (!part) {
      return false
    }

    const normalizedPart = part.toLowerCase()

    if (normalizedPart.includes(normalizedQuery)) {
      return true
    }

    if (digitQuery && part.replace(/\D/g, "").includes(digitQuery)) {
      return true
    }

    return false
  })
}

function formatDateTime(value: Date | undefined, locale: "en" | "vi") {
  if (!value) {
    return locale === "en" ? "N/A" : "Không có"
  }

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value)
}

function formatNumber(value: number, locale: "en" | "vi") {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(value)
}

function ChartPanel({
  points,
  subtitle,
  title,
}: {
  points: Array<{ label: string; value: number }>
  subtitle: string
  title: string
}) {
  const maxValue = Math.max(...points.map((point) => point.value), 1)

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex h-44 items-end gap-2">
        {points.map((point) => {
          const height = point.value === 0 ? 10 : Math.max((point.value / maxValue) * 100, 14)

          return (
            <div key={`${point.label}-${point.value}`} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">{point.value}</span>
              <div className="flex h-32 w-full items-end rounded-xl bg-muted/40 p-1.5">
                <div
                  className="w-full rounded-lg bg-primary/85"
                  style={{
                    height: `${height}%`,
                  }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">{point.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ copy }: { copy: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">{copy}</div>
}

function AdminConsoleLoadingState({ locale }: { locale: "en" | "vi" }) {
  return (
    <Tabs defaultValue="dashboard" className="space-y-5">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-muted/70 p-2">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="requests">Coach Requests</TabsTrigger>
        <TabsTrigger value="connections">Connections</TabsTrigger>
        <TabsTrigger value="programs">Programs</TabsTrigger>
        <TabsTrigger value="exercises">Exercises</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-9 w-28" />
              <Skeleton className="mt-2 h-4 w-36" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 p-1">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-border bg-card p-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-2 h-4 w-48 max-w-full" />
              <div className="mt-6 flex h-44 items-end gap-2">
                {Array.from({ length: 6 }, (_, barIndex) => (
                  <div key={barIndex} className="flex flex-1 flex-col items-center gap-2">
                    <Skeleton className="h-3 w-8" />
                    <div className="flex h-32 w-full items-end rounded-xl bg-muted/40 p-1.5">
                      <Skeleton className="w-full rounded-lg" style={{ height: `${35 + barIndex * 8}%` }} />
                    </div>
                    <Skeleton className="h-3 w-6" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="mt-2 h-4 w-52 max-w-full" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: 4 }, (_, itemIndex) => (
                  <Skeleton key={itemIndex} className="h-16 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="min-h-[40px] text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{locale === "en" ? "Loading admin console..." : "Đang tải bảng điều khiển admin..."}</span>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}

export function AdminConsole() {
  const { locale } = useLocale()
  const { session } = useAuth()
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null)
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null)
  const [coachRequests, setCoachRequests] = useState<AdminCoachRequest[]>([])
  const [connections, setConnections] = useState<AdminConnectionsData | null>(null)
  const [programs, setPrograms] = useState<AdminProgramSummary[]>([])
  const [exercises, setExercises] = useState<AdminExerciseItem[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>("trainee")
  const [resetPassword, setResetPassword] = useState("")
  const [assignTraineeId, setAssignTraineeId] = useState("")
  const [assignCoachId, setAssignCoachId] = useState("")
  const [exerciseForm, setExerciseForm] = useState<ExerciseFormState>({
    equipment: "",
    muscleGroup: "",
    name: "",
  })
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState<UserRole | "all">("all")
  const [requestSearch, setRequestSearch] = useState("")
  const [requestStatusFilter, setRequestStatusFilter] = useState<AdminCoachRequest["status"] | "all">("all")
  const [connectionSearch, setConnectionSearch] = useState("")
  const [programSearch, setProgramSearch] = useState("")
  const [exerciseSearch, setExerciseSearch] = useState("")
  const [openExerciseGroups, setOpenExerciseGroups] = useState<string[]>([])
  const [auditSearch, setAuditSearch] = useState("")
  const [auditEntityType, setAuditEntityType] = useState("all")
  const [chartView, setChartView] = useState<"weekly" | "monthly">("weekly")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionKey, setActionKey] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFileName, setImportFileName] = useState("")
  const [importRows, setImportRows] = useState<AdminExerciseImportRow[]>([])
  const [importIssues, setImportIssues] = useState<ExerciseImportIssue[]>([])
  const [importInputKey, setImportInputKey] = useState(0)

  useEffect(() => {
    if (!userDetail) {
      return
    }

    setSelectedRole(userDetail.user.role)
  }, [userDetail])

  async function refreshAllData(accessToken: string, preferredUserId?: string | null, silent?: boolean) {
    if (!silent) {
      setIsLoading(true)
    }

    setError(null)

    try {
      const [nextDashboard, nextUsers, nextRequests, nextConnections, nextPrograms, nextExercises, nextAuditLogs] =
        await Promise.all([
          fetchAdminDashboard(accessToken),
          fetchAdminUsers(accessToken),
          fetchAdminCoachRequests(accessToken),
          fetchAdminConnections(accessToken),
          fetchAdminPrograms(accessToken),
          fetchAdminExercises(accessToken),
          fetchAdminAuditLogs(accessToken),
        ])

      const nextSelectedUserId =
        preferredUserId && nextUsers.some((user) => user.id === preferredUserId)
          ? preferredUserId
          : nextUsers[0]?.id ?? null

      const nextUserDetail = nextSelectedUserId
        ? await fetchAdminUserDetail(accessToken, nextSelectedUserId)
        : null

      setDashboard(nextDashboard)
      setUsers(nextUsers)
      setCoachRequests(nextRequests)
      setConnections(nextConnections)
      setPrograms(nextPrograms)
      setExercises(nextExercises)
      setAuditLogs(nextAuditLogs)
      setSelectedUserId(nextSelectedUserId)
      setUserDetail(nextUserDetail)

      setAssignCoachId((current) =>
        nextConnections.coaches.some((coach) => coach.id === current) ? current : nextConnections.coaches[0]?.id ?? "",
      )
      setAssignTraineeId((current) =>
        nextConnections.unassignedTrainees.some((trainee) => trainee.id === current)
          ? current
          : nextConnections.unassignedTrainees[0]?.id ?? "",
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu admin.")
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!session?.access_token) {
      return
    }

    void refreshAllData(session.access_token, selectedUserId)
  }, [session?.access_token])

  async function loadUserDetail(userId: string) {
    if (!session?.access_token) {
      return
    }

    setError(null)

    try {
      setSelectedUserId(userId)
      setUserDetail(await fetchAdminUserDetail(session.access_token, userId))
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Không thể tải chi tiết người dùng.")
    }
  }

  function resetExerciseForm() {
    setExerciseForm({
      equipment: "",
      muscleGroup: "",
      name: "",
    })
  }

  function resetImportState() {
    setImportFileName("")
    setImportRows([])
    setImportIssues([])
    setImportInputKey((current) => current + 1)
  }

  function handleImportDialogChange(open: boolean) {
    setIsImportDialogOpen(open)

    if (!open && actionKey !== "exercise-import") {
      resetImportState()
    }
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setActionKey("exercise-import-parse")
    setError(null)
    setNotice(null)

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, {
        type: "array",
      })
      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        throw new Error(locale === "en" ? "The selected file has no worksheets." : "File được chọn không có worksheet nào.")
      }

      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Array<string | number | null | undefined>>(sheet, {
        blankrows: false,
        defval: "",
        header: 1,
        raw: false,
      })

      if (!rows.length) {
        throw new Error(locale === "en" ? "The selected file is empty." : "File được chọn đang trống.")
      }

      const headerRow = rows[0] ?? []
      const columnMap = headerRow.reduce<Partial<Record<keyof typeof EXERCISE_IMPORT_HEADERS, number>>>((result, cell, index) => {
        const column = resolveImportColumn(cell)

        if (column && typeof result[column] !== "number") {
          result[column] = index
        }

        return result
      }, {})

      const missingColumns = [
        typeof columnMap.name !== "number" ? (locale === "en" ? "name" : "tên bài tập") : null,
        typeof columnMap.muscleGroup !== "number" ? (locale === "en" ? "muscle group" : "nhóm cơ") : null,
      ].filter(Boolean) as string[]

      if (missingColumns.length > 0) {
        throw new Error(
          locale === "en"
            ? `Missing required columns: ${missingColumns.join(", ")}.`
            : `Thiếu cột bắt buộc: ${missingColumns.join(", ")}.`,
        )
      }

      const nextRows: AdminExerciseImportRow[] = []
      const nextIssues: ExerciseImportIssue[] = []

      rows.slice(1).forEach((row, index) => {
        const rowNumber = index + 2
        const name = String(row[columnMap.name as number] ?? "").trim()
        const muscleGroup = String(row[columnMap.muscleGroup as number] ?? "").trim()
        const equipmentIndex = columnMap.equipment
        const equipment = typeof equipmentIndex === "number" ? String(row[equipmentIndex] ?? "").trim() : ""
        const isBlankRow = !name && !muscleGroup && !equipment

        if (isBlankRow) {
          return
        }

        if (!name || !muscleGroup) {
          nextIssues.push({
            message:
              locale === "en"
                ? "Missing exercise name or muscle group."
                : "Thiếu tên bài tập hoặc nhóm cơ.",
            rowNumber,
          })
          return
        }

        nextRows.push({
          equipment: equipment || undefined,
          muscleGroup,
          name,
          rowNumber,
        })
      })

      if (!nextRows.length && !nextIssues.length) {
        nextIssues.push({
          message: locale === "en" ? "No exercise rows were detected." : "Không tìm thấy dòng bài tập nào trong file.",
        })
      }

      setImportFileName(file.name)
      setImportRows(nextRows)
      setImportIssues(nextIssues)
    } catch (importError) {
      setImportFileName(file.name)
      setImportRows([])
      setImportIssues([
        {
          message:
            importError instanceof Error
              ? importError.message
              : locale === "en"
                ? "Unable to parse the selected file."
                : "Không thể đọc file đã chọn.",
        },
      ])
    } finally {
      setActionKey(null)
    }
  }

  async function handleUserUpdate(input: { isActive?: boolean; role?: UserRole }) {
    if (!session?.access_token || !userDetail) {
      return
    }

    setActionKey(`user-${userDetail.user.id}`)
    setError(null)
    setNotice(null)

    try {
      await updateAdminUserRequest(session.access_token, userDetail.user.id, input)
      await refreshAllData(session.access_token, userDetail.user.id, true)
      setNotice(locale === "en" ? "User updated successfully." : "Đã cập nhật tài khoản người dùng.")
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Không thể cập nhật người dùng.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleResetPassword() {
    if (!session?.access_token || !userDetail) {
      return
    }

    setActionKey(`password-${userDetail.user.id}`)
    setError(null)
    setNotice(null)

    try {
      await resetAdminUserPasswordRequest(session.access_token, userDetail.user.id, resetPassword)
      setResetPassword("")
      await refreshAllData(session.access_token, userDetail.user.id, true)
      setNotice(locale === "en" ? "Password reset successfully." : "Đã reset mật khẩu thủ công.")
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Không thể reset mật khẩu.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleCoachRequestAction(requestId: string, status: "approved" | "rejected") {
    if (!session?.access_token) {
      return
    }

    setActionKey(`request-${requestId}-${status}`)
    setError(null)
    setNotice(null)

    try {
      await updateAdminCoachRequestStatus(session.access_token, requestId, status)
      await refreshAllData(session.access_token, selectedUserId, true)
      setNotice(
        status === "approved"
          ? locale === "en"
            ? "Coach request approved."
            : "Đã duyệt coach request."
          : locale === "en"
            ? "Coach request rejected."
            : "Đã từ chối coach request.",
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể xử lý coach request.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleAssignConnection() {
    if (!session?.access_token || !assignCoachId || !assignTraineeId) {
      return
    }

    setActionKey("connection-assign")
    setError(null)
    setNotice(null)

    try {
      await assignAdminCoachConnection(session.access_token, {
        coachId: assignCoachId,
        traineeId: assignTraineeId,
      })
      await refreshAllData(session.access_token, selectedUserId, true)
      setNotice(locale === "en" ? "Coach assigned successfully." : "Đã gán coach cho trainee.")
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Không thể gán coach.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleSaveExercise() {
    if (!session?.access_token) {
      return
    }

    setActionKey(exerciseForm.id ? `exercise-update-${exerciseForm.id}` : "exercise-create")
    setError(null)
    setNotice(null)

    try {
      if (exerciseForm.id) {
        await updateAdminExerciseRequest(session.access_token, exerciseForm.id, exerciseForm)
        setNotice(locale === "en" ? "Exercise updated." : "Đã cập nhật bài tập.")
      } else {
        await createAdminExerciseRequest(session.access_token, exerciseForm)
        setNotice(locale === "en" ? "Exercise created." : "Đã tạo bài tập mới.")
      }

      resetExerciseForm()
      await refreshAllData(session.access_token, selectedUserId, true)
    } catch (exerciseError) {
      setError(exerciseError instanceof Error ? exerciseError.message : "Không thể lưu bài tập.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleImportExercises() {
    if (!session?.access_token || !importRows.length || importIssues.length > 0) {
      return
    }

    setActionKey("exercise-import")
    setError(null)
    setNotice(null)

    try {
      const result = await importAdminExercisesRequest(session.access_token, importRows)
      setNotice(
        locale === "en"
          ? `Imported ${result.createdCount} exercises and skipped ${result.skippedCount}.`
          : `Đã import ${result.createdCount} bài tập và bỏ qua ${result.skippedCount} dòng.`,
      )
      await refreshAllData(session.access_token, selectedUserId, true)
      setIsImportDialogOpen(false)
      resetImportState()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Không thể import danh sách bài tập.")
    } finally {
      setActionKey(null)
    }
  }

  async function handleConfirmAction() {
    if (!session?.access_token || !confirmState) {
      return
    }

    setActionKey(`confirm-${confirmState.kind}-${confirmState.id}`)
    setError(null)
    setNotice(null)

    try {
      if (confirmState.kind === "request") {
        await deleteAdminCoachRequestRequest(session.access_token, confirmState.id)
      }

      if (confirmState.kind === "program") {
        await deleteAdminProgramRequest(session.access_token, confirmState.id)
      }

      if (confirmState.kind === "exercise") {
        await deleteAdminExerciseRequest(session.access_token, confirmState.id)
        if (exerciseForm.id === confirmState.id) {
          resetExerciseForm()
        }
      }

      if (confirmState.kind === "connection") {
        await removeAdminCoachConnection(session.access_token, confirmState.id)
      }

      setConfirmState(null)
      await refreshAllData(session.access_token, selectedUserId, true)
      setNotice(locale === "en" ? "Action completed successfully." : "Đã thực hiện thao tác thành công.")
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Không thể hoàn tất thao tác.")
    } finally {
      setActionKey(null)
    }
  }

  const filteredUsers = users.filter((user) => {
    const matchesRole = userRoleFilter === "all" ? true : user.role === userRoleFilter

    return (
      matchesRole &&
      matchesSearch([user.name, user.email, user.username, user.phone, user.coach?.name, user.coach?.email], userSearch)
    )
  })

  const filteredRequests = coachRequests.filter((request) => {
    const matchesStatus = requestStatusFilter === "all" ? true : request.status === requestStatusFilter

    return matchesStatus && matchesSearch([request.trainee.name, request.trainee.email, request.coach.name, request.coach.email], requestSearch)
  })

  const filteredConnections =
    connections?.connections.filter((connection) =>
      matchesSearch(
        [connection.trainee.name, connection.trainee.email, connection.coach.name, connection.coach.email],
        connectionSearch,
      ),
    ) ?? []

  const filteredPrograms = programs.filter((program) =>
    matchesSearch([program.name, program.description, program.createdBy.name, program.createdBy.email], programSearch),
  )

  const filteredExercises = exercises.filter((exercise) =>
    matchesSearch([exercise.name, exercise.muscleGroup, exercise.equipment, exercise.createdBy?.name], exerciseSearch),
  )
  const groupedExercisesMap = new Map<string, ExerciseGroupItem>()
  const sortedExercises = [...filteredExercises].sort((left, right) => {
    const language = locale === "vi" ? "vi" : "en"
    const groupComparison = left.muscleGroup.localeCompare(right.muscleGroup, language, { sensitivity: "base" })

    if (groupComparison !== 0) {
      return groupComparison
    }

    return left.name.localeCompare(right.name, language, { sensitivity: "base" })
  })

  for (const exercise of sortedExercises) {
    const muscleGroup = exercise.muscleGroup.trim() || (locale === "en" ? "Other" : "Khác")
    const groupKey = muscleGroup.toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US")
    const existingGroup = groupedExercisesMap.get(groupKey)

    if (existingGroup) {
      existingGroup.exercises.push(exercise)
      existingGroup.totalUsageCount += exercise.usageCount
      continue
    }

    groupedExercisesMap.set(groupKey, {
      exercises: [exercise],
      groupKey,
      muscleGroup,
      totalUsageCount: exercise.usageCount,
    })
  }

  const groupedExercises = Array.from(groupedExercisesMap.values()).sort((left, right) =>
    left.muscleGroup.localeCompare(right.muscleGroup, locale === "vi" ? "vi" : "en", { sensitivity: "base" }),
  )
  const shouldAutoExpandExerciseGroups = exerciseSearch.trim().length > 0
  const totalExerciseUsageCount = groupedExercises.reduce((sum, group) => sum + group.totalUsageCount, 0)

  const importPreviewRows = importRows.slice(0, 8)

  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesEntityType = auditEntityType === "all" ? true : log.entityType === auditEntityType
    return matchesEntityType && matchesSearch([log.action, log.entityType, log.entityLabel, log.admin.name], auditSearch)
  })
  const isConsolePending = !session?.access_token || isLoading
  const topStats = [
    { label: "Admins", value: dashboard?.stats.totalAdmins },
    { label: "Programs", value: dashboard?.stats.totalPrograms },
    { label: "Meals", value: dashboard?.stats.totalMeals },
    { label: "Workout Logs", value: dashboard?.stats.totalWorkoutLogs },
  ] as const

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              {locale === "en" ? "Admin Control Center" : "Trung tâm điều khiển Admin"}
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">
              {locale === "en" ? "System administration" : "Quản trị hệ thống"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {locale === "en"
                ? "Manage users, coach flows, library data, audits, and platform health in one place."
                : "Quản lý user, coach flow, dữ liệu thư viện, audit và sức khoẻ nền tảng trong cùng một nơi."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
            {topStats.map((item) => (
              <div key={item.label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                {typeof item.value === "number" ? (
                  <p className="text-xl font-semibold tabular-nums">{item.value}</p>
                ) : (
                  <Skeleton className="mt-2 h-7 w-16" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-[52px]">
          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!error && notice ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              {notice}
            </div>
          ) : null}
        </div>

        {isConsolePending ? (
          <AdminConsoleLoadingState locale={locale} />
        ) : (
          <Tabs defaultValue="dashboard" className="space-y-5">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-muted/70 p-2">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests">Coach Requests</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="exercises">Exercises</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatsCard title="Total Users" value={dashboard?.stats.totalUsers ?? 0} subtitle={locale === "en" ? "all roles" : "mọi vai trò"} iconName="users" variant="primary" />
              <StatsCard title="Coaches" value={dashboard?.stats.totalCoaches ?? 0} subtitle={locale === "en" ? "coach accounts" : "tài khoản coach"} iconName="shield-check" />
              <StatsCard title="Trainees" value={dashboard?.stats.totalTrainees ?? 0} subtitle={locale === "en" ? "fitness users" : "người dùng fitness"} iconName="users" />
              <StatsCard title="Active 7d" value={dashboard?.stats.activeUsersLast7Days ?? 0} subtitle={locale === "en" ? "users with activity in 7 days" : "user có hoạt động trong 7 ngày"} iconName="target" />
              <StatsCard title="Active 30d" value={dashboard?.stats.activeUsersLast30Days ?? 0} subtitle={locale === "en" ? "users with activity in 30 days" : "user có hoạt động trong 30 ngày"} iconName="trending-up" variant="accent" />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div>
                <h2 className="text-lg font-semibold">{locale === "en" ? "Platform charts" : "Biểu đồ nền tảng"}</h2>
                <p className="text-sm text-muted-foreground">
                  {locale === "en" ? "Track growth, active users, and workout logs by week or month." : "Theo dõi tăng trưởng, active users và workout logs theo tuần hoặc tháng."}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 p-1">
                <Button variant={chartView === "weekly" ? "default" : "ghost"} size="sm" onClick={() => setChartView("weekly")}>
                  {locale === "en" ? "Weekly" : "Theo tuần"}
                </Button>
                <Button variant={chartView === "monthly" ? "default" : "ghost"} size="sm" onClick={() => setChartView("monthly")}>
                  {locale === "en" ? "Monthly" : "Theo tháng"}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <ChartPanel
                title={locale === "en" ? "User growth" : "Tăng trưởng user"}
                subtitle={locale === "en" ? "New accounts created" : "Số tài khoản mới được tạo"}
                points={dashboard?.charts.userGrowth[chartView] ?? []}
              />
              <ChartPanel
                title={locale === "en" ? "Active users" : "Người dùng hoạt động"}
                subtitle={locale === "en" ? "Users with meal or workout activity" : "User có meal hoặc workout activity"}
                points={dashboard?.charts.activeUsers[chartView] ?? []}
              />
              <ChartPanel
                title={locale === "en" ? "Workout logs" : "Workout logs"}
                subtitle={locale === "en" ? "Completed or started sessions" : "Số phiên tập đã bắt đầu hoặc hoàn thành"}
                points={dashboard?.charts.workoutLogs[chartView] ?? []}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{locale === "en" ? "Recent users" : "Người dùng gần đây"}</h3>
                    <p className="text-sm text-muted-foreground">{locale === "en" ? "Newest accounts in the system." : "Các tài khoản mới nhất trong hệ thống."}</p>
                  </div>
                  <Badge variant="outline">{dashboard?.recentUsers.length ?? 0}</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard?.recentUsers.length ? (
                    dashboard.recentUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full rounded-xl border border-border/70 bg-muted/20 p-4 text-left transition-colors hover:border-primary/30"
                        onClick={() => {
                          setSelectedUserId(user.id)
                          void refreshAllData(session.access_token, user.id, true)
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{user.name}</p>
                              <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
                              {!user.isActive ? <Badge variant="destructive">{locale === "en" ? "Locked" : "Đã khoá"}</Badge> : null}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDateTime(user.createdAt, locale)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <EmptyState copy={locale === "en" ? "No users found." : "Chưa có user nào."} />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{locale === "en" ? "Pending coach requests" : "Coach requests chờ duyệt"}</h3>
                    <p className="text-sm text-muted-foreground">{locale === "en" ? "Waiting for admin review." : "Đang chờ admin xử lý."}</p>
                  </div>
                  <Badge>{dashboard?.pendingCoachRequests.length ?? 0}</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard?.pendingCoachRequests.length ? (
                    dashboard.pendingCoachRequests.map((request) => (
                      <div key={request.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <Badge variant={requestBadgeVariant(request.status)}>{request.status}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDateTime(request.createdAt, locale)}</span>
                        </div>
                        <p className="text-sm font-medium">{request.trainee.name}</p>
                        <p className="text-xs text-muted-foreground">{request.trainee.email}</p>
                        <div className="my-3 h-px bg-border" />
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Coach" : "Coach"}</p>
                        <p className="text-sm font-medium">{request.coach.name}</p>
                        <p className="text-xs text-muted-foreground">{request.coach.email}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState copy={locale === "en" ? "No pending coach requests." : "Hiện không có coach request nào chờ duyệt."} />
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{locale === "en" ? "Top coaches" : "Coach nổi bật"}</h3>
                  <Badge variant="secondary">{dashboard?.topCoaches.length ?? 0}</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard?.topCoaches.length ? (
                    dashboard.topCoaches.map((coach, index) => (
                      <div key={coach.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                            <p className="font-medium">{coach.name}</p>
                            {!coach.isActive ? <Badge variant="destructive">{locale === "en" ? "Locked" : "Đã khoá"}</Badge> : null}
                          </div>
                          <p className="text-sm text-muted-foreground">{coach.email}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium">{coach.traineeCount} trainees</p>
                          <p className="text-muted-foreground">{coach.programCount} programs</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState copy={locale === "en" ? "No coaches yet." : "Chưa có coach nào."} />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{locale === "en" ? "Recent programs" : "Giáo án gần đây"}</h3>
                  <Badge variant="outline">{dashboard?.recentPrograms.length ?? 0}</Badge>
                </div>

                <div className="space-y-3">
                  {dashboard?.recentPrograms.length ? (
                    dashboard.recentPrograms.map((program) => (
                      <div key={program.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="font-medium">{program.name}</p>
                          <Badge variant="outline">{program.difficulty}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{program.createdBy.name}</p>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                          <p>{program.duration} {locale === "en" ? "weeks" : "tuần"}</p>
                          <p>{program.workoutsPerWeek} {locale === "en" ? "workouts/week" : "buổi/tuần"}</p>
                          <p>{program.assignmentCount} {locale === "en" ? "assignments" : "gán"}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState copy={locale === "en" ? "No programs found." : "Chưa có giáo án nào."} />
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={locale === "en" ? "Search by name, email, username, phone..." : "Tìm theo tên, email, username, số điện thoại..."} className="pl-9" />
              </div>
              <Select value={userRoleFilter} onValueChange={(value) => setUserRoleFilter(value as UserRole | "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{locale === "en" ? "All roles" : "Tất cả vai trò"}</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                  <SelectItem value="trainee">Trainee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.45fr)]">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{locale === "en" ? "All users" : "Toàn bộ user"}</h3>
                  <Badge variant="outline">{filteredUsers.length}</Badge>
                </div>

                <div className="space-y-3">
                  {filteredUsers.length ? (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className={`w-full rounded-xl border p-4 text-left transition-colors ${
                          selectedUserId === user.id
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/70 bg-muted/20 hover:border-primary/25"
                        }`}
                        onClick={() => void loadUserDetail(user.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium">{user.name}</p>
                              <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
                              {!user.isActive ? <Badge variant="destructive">{locale === "en" ? "Locked" : "Đã khoá"}</Badge> : null}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {user.phone ?? (locale === "en" ? "No phone" : "Chưa có số điện thoại")}
                            </p>
                          </div>

                          <div className="text-right text-xs text-muted-foreground">
                            <p>{formatDateTime(user.createdAt, locale)}</p>
                            <p className="mt-2">{user.stats.workoutLogs} logs</p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <EmptyState copy={locale === "en" ? "No users match the current filters." : "Không có user nào khớp bộ lọc hiện tại."} />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                {userDetail ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{userDetail.user.name}</h3>
                          <Badge variant={roleBadgeVariant(userDetail.user.role)}>{userDetail.user.role}</Badge>
                          {!userDetail.user.isActive ? <Badge variant="destructive">{locale === "en" ? "Locked" : "Đã khoá"}</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{userDetail.user.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {userDetail.user.phone ?? (locale === "en" ? "No phone number" : "Chưa có số điện thoại")}
                        </p>
                      </div>

                      <div className="grid min-w-[220px] grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">{locale === "en" ? "Created" : "Tạo lúc"}</p>
                          <p className="font-medium">{formatDateTime(userDetail.user.createdAt, locale)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{locale === "en" ? "Updated" : "Cập nhật"}</p>
                          <p className="font-medium">{formatDateTime(userDetail.user.updatedAt, locale)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <UserCog className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{locale === "en" ? "Account controls" : "Quản lý tài khoản"}</h4>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label>{locale === "en" ? "Role" : "Vai trò"}</Label>
                            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                              <SelectTrigger className="mt-1.5 w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="coach">Coach</SelectItem>
                                <SelectItem value="trainee">Trainee</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => void handleUserUpdate({ role: selectedRole })} disabled={actionKey === `user-${userDetail.user.id}`}>
                              {actionKey === `user-${userDetail.user.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              {locale === "en" ? "Save role" : "Lưu vai trò"}
                            </Button>
                            <Button variant={userDetail.user.isActive ? "destructive" : "outline"} onClick={() => void handleUserUpdate({ isActive: !userDetail.user.isActive })} disabled={actionKey === `user-${userDetail.user.id}`}>
                              {userDetail.user.isActive ? (locale === "en" ? "Lock account" : "Khoá tài khoản") : locale === "en" ? "Unlock account" : "Mở khoá tài khoản"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{locale === "en" ? "Manual password reset" : "Reset mật khẩu thủ công"}</h4>
                        </div>

                        <div className="space-y-3">
                          <Input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder={locale === "en" ? "Enter a new password" : "Nhập mật khẩu mới"} />
                          <Button onClick={() => void handleResetPassword()} disabled={actionKey === `password-${userDetail.user.id}`}>
                            {actionKey === `password-${userDetail.user.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            {locale === "en" ? "Reset password" : "Reset mật khẩu"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <StatsCard title="Programs Created" value={userDetail.user.stats.createdPrograms} iconName="clipboard-list" />
                      <StatsCard title="Programs Assigned" value={userDetail.user.stats.assignedPrograms} iconName="target" />
                      <StatsCard title="Workout Logs" value={userDetail.user.stats.workoutLogs} iconName="trending-up" />
                      <StatsCard title="Trainees" value={userDetail.user.stats.trainees} iconName="users" />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <h4 className="mb-3 font-medium">{locale === "en" ? "Connections" : "Kết nối"}</h4>
                        {userDetail.assignedCoach ? (
                          <div className="mb-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                            <p className="font-medium">{locale === "en" ? "Assigned coach" : "Coach hiện tại"}</p>
                            <p>{userDetail.assignedCoach.name}</p>
                            <p className="text-muted-foreground">{userDetail.assignedCoach.email}</p>
                          </div>
                        ) : null}

                        {userDetail.connectedTrainees.length ? (
                          <div className="space-y-2">
                            {userDetail.connectedTrainees.map((trainee) => (
                              <div key={trainee.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <p className="font-medium">{trainee.name}</p>
                                <p className="text-muted-foreground">{trainee.email}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState copy={locale === "en" ? "No direct trainee connections for this user." : "Người dùng này chưa có trainee connection trực tiếp."} />
                        )}
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <h4 className="mb-3 font-medium">{locale === "en" ? "Recent workout logs" : "Workout logs gần đây"}</h4>
                        {userDetail.recentWorkoutLogs.length ? (
                          <div className="space-y-2">
                            {userDetail.recentWorkoutLogs.map((log) => (
                              <div key={log.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">{log.workout?.name ?? (locale === "en" ? "Workout snapshot" : "Workout snapshot")}</p>
                                  <span className="text-xs text-muted-foreground">{formatDateTime(log.startedAt, locale)}</span>
                                </div>
                                <p className="text-muted-foreground">{log.totalVolume ? `${formatNumber(log.totalVolume, locale)} total volume` : locale === "en" ? "No volume recorded" : "Chưa có volume"}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState copy={locale === "en" ? "No workout logs yet." : "Chưa có workout log nào."} />
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <h4 className="mb-3 font-medium">{locale === "en" ? "Programs" : "Giáo án"}</h4>
                        {userDetail.createdPrograms.length || userDetail.assignedPrograms.length ? (
                          <div className="space-y-2">
                            {userDetail.createdPrograms.map((program) => (
                              <div key={`created-${program.id}`} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <p className="font-medium">{program.name}</p>
                                <p className="text-muted-foreground">{locale === "en" ? "Created program" : "Giáo án đã tạo"}</p>
                              </div>
                            ))}
                            {userDetail.assignedPrograms.map((program) => (
                              <div key={`assigned-${program.id}`} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <p className="font-medium">{program.name}</p>
                                <p className="text-muted-foreground">{locale === "en" ? "Assigned program" : "Giáo án được gán"}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState copy={locale === "en" ? "No related programs." : "Chưa có giáo án liên quan."} />
                        )}
                      </div>

                      <div className="rounded-xl border border-border bg-muted/20 p-4">
                        <h4 className="mb-3 font-medium">{locale === "en" ? "Coach requests & audit" : "Coach requests & audit"}</h4>
                        {userDetail.coachRequests.length || userDetail.recentAuditLogs.length ? (
                          <div className="space-y-2">
                            {userDetail.coachRequests.slice(0, 4).map((request) => (
                              <div key={request.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium">
                                    {request.trainee.name} {"->"} {request.coach.name}
                                  </p>
                                  <Badge variant={requestBadgeVariant(request.status)}>{request.status}</Badge>
                                </div>
                              </div>
                            ))}
                            {userDetail.recentAuditLogs.slice(0, 4).map((log) => (
                              <div key={log.id} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                <p className="font-medium">{log.action}</p>
                                <p className="text-muted-foreground">{formatDateTime(log.createdAt, locale)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState copy={locale === "en" ? "No requests or audit records." : "Chưa có request hoặc audit log."} />
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState copy={locale === "en" ? "Select a user to view details." : "Chọn một user để xem chi tiết."} />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder={locale === "en" ? "Search coach requests..." : "Tìm coach requests..."} className="pl-9" />
              </div>
              <Select value={requestStatusFilter} onValueChange={(value) => setRequestStatusFilter(value as AdminCoachRequest["status"] | "all")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{locale === "en" ? "All statuses" : "Tất cả trạng thái"}</SelectItem>
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="rejected">rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredRequests.length ? (
                filteredRequests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Badge variant={requestBadgeVariant(request.status)}>{request.status}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(request.createdAt, locale)}</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Trainee" : "Trainee"}</p>
                        <p className="font-medium">{request.trainee.name}</p>
                        <p className="text-sm text-muted-foreground">{request.trainee.email}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Coach" : "Coach"}</p>
                        <p className="font-medium">{request.coach.name}</p>
                        <p className="text-sm text-muted-foreground">{request.coach.email}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {request.status === "pending" ? (
                        <>
                          <Button size="sm" onClick={() => void handleCoachRequestAction(request.id, "approved")} disabled={actionKey === `request-${request.id}-approved`}>
                            {actionKey === `request-${request.id}-approved` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}
                            {locale === "en" ? "Approve" : "Duyệt"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleCoachRequestAction(request.id, "rejected")} disabled={actionKey === `request-${request.id}-rejected`}>
                            {locale === "en" ? "Reject" : "Từ chối"}
                          </Button>
                        </>
                      ) : null}
                      <Button size="sm" variant="destructive" onClick={() => setConfirmState({ id: request.id, kind: "request", label: `${request.trainee.name} -> ${request.coach.name}` })}>
                        <Trash2 className="h-4 w-4" />
                        {locale === "en" ? "Cancel / delete" : "Huỷ / xoá"}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState copy={locale === "en" ? "No coach requests match the current filters." : "Không có coach request nào khớp bộ lọc hiện tại."} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="connections" className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{locale === "en" ? "Assign coach to trainee" : "Gán coach cho trainee"}</h3>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Select value={assignTraineeId} onValueChange={setAssignTraineeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={locale === "en" ? "Choose trainee" : "Chọn trainee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {connections?.unassignedTrainees.map((trainee) => (
                      <SelectItem key={trainee.id} value={trainee.id}>{trainee.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={assignCoachId} onValueChange={setAssignCoachId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={locale === "en" ? "Choose coach" : "Chọn coach"} />
                  </SelectTrigger>
                  <SelectContent>
                    {connections?.coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>{coach.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={() => void handleAssignConnection()} disabled={actionKey === "connection-assign" || !assignCoachId || !assignTraineeId}>
                  {actionKey === "connection-assign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {locale === "en" ? "Assign" : "Gán"}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={connectionSearch} onChange={(event) => setConnectionSearch(event.target.value)} placeholder={locale === "en" ? "Search current connections..." : "Tìm connection hiện tại..."} className="pl-9" />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredConnections.length ? (
                filteredConnections.map((connection) => (
                  <div key={connection.trainee.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Badge variant="outline">{locale === "en" ? "Connected" : "Đang kết nối"}</Badge>
                      <Button size="sm" variant="destructive" onClick={() => setConfirmState({ id: connection.trainee.id, kind: "connection", label: `${connection.trainee.name} - ${connection.coach.name}` })}>
                        <Trash2 className="h-4 w-4" />
                        {locale === "en" ? "Remove" : "Gỡ kết nối"}
                      </Button>
                    </div>
                    <p className="font-medium">{connection.trainee.name}</p>
                    <p className="text-sm text-muted-foreground">{connection.trainee.email}</p>
                    <div className="my-3 h-px bg-border" />
                    <p className="font-medium">{connection.coach.name}</p>
                    <p className="text-sm text-muted-foreground">{connection.coach.email}</p>
                  </div>
                ))
              ) : (
                <EmptyState copy={locale === "en" ? "No coach-trainee connections found." : "Chưa có connection coach-trainee nào."} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="programs" className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={programSearch} onChange={(event) => setProgramSearch(event.target.value)} placeholder={locale === "en" ? "Search programs..." : "Tìm giáo án..."} className="pl-9" />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {filteredPrograms.length ? (
                filteredPrograms.map((program) => (
                  <div key={program.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{program.name}</h3>
                          <Badge variant="outline">{program.difficulty}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{program.createdBy.name}</p>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => setConfirmState({ id: program.id, kind: "program", label: program.name })}>
                        <Trash2 className="h-4 w-4" />
                        {locale === "en" ? "Delete" : "Xoá"}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{program.description ?? (locale === "en" ? "No description." : "Chưa có mô tả.")}</p>
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                      <p>{program.duration} {locale === "en" ? "weeks" : "tuần"}</p>
                      <p>{program.workoutsPerWeek} {locale === "en" ? "workouts/week" : "buổi/tuần"}</p>
                      <p>{program.assignmentCount} {locale === "en" ? "assignments" : "gán"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState copy={locale === "en" ? "No programs match the current search." : "Không có giáo án nào khớp tìm kiếm hiện tại."} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="exercises" className="space-y-5">
            <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{exerciseForm.id ? (locale === "en" ? "Edit exercise" : "Sửa bài tập") : locale === "en" ? "Create exercise" : "Tạo bài tập"}</h3>
                    <p className="text-sm text-muted-foreground">{locale === "en" ? "Manage the shared exercise library." : "Quản lý thư viện bài tập dùng chung."}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                      <FileSpreadsheet className="h-4 w-4" />
                      {locale === "en" ? "Import Excel" : "Import Excel"}
                    </Button>
                    {exerciseForm.id ? (
                      <Button variant="ghost" size="sm" onClick={resetExerciseForm}>
                        {locale === "en" ? "New" : "Mới"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>{locale === "en" ? "Exercise name" : "Tên bài tập"}</Label>
                    <Input className="mt-1.5" value={exerciseForm.name} onChange={(event) => setExerciseForm((current) => ({ ...current, name: event.target.value }))} />
                  </div>
                  <div>
                    <Label>{locale === "en" ? "Muscle group" : "Nhóm cơ"}</Label>
                    <Input className="mt-1.5" value={exerciseForm.muscleGroup} onChange={(event) => setExerciseForm((current) => ({ ...current, muscleGroup: event.target.value }))} />
                  </div>
                  <div>
                    <Label>{locale === "en" ? "Equipment" : "Thiết bị"}</Label>
                    <Input className="mt-1.5" value={exerciseForm.equipment} onChange={(event) => setExerciseForm((current) => ({ ...current, equipment: event.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={() => void handleSaveExercise()} disabled={actionKey === (exerciseForm.id ? `exercise-update-${exerciseForm.id}` : "exercise-create")}>
                    {actionKey === (exerciseForm.id ? `exercise-update-${exerciseForm.id}` : "exercise-create") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {exerciseForm.id ? (locale === "en" ? "Update exercise" : "Cập nhật bài tập") : locale === "en" ? "Create exercise" : "Tạo bài tập"}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{locale === "en" ? "Bulk import" : "Import hàng loạt"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {locale === "en"
                          ? "Upload .xlsx, .xls, or .csv with columns: name, muscleGroup, equipment."
                          : "Tải lên file .xlsx, .xls hoặc .csv với các cột: name, muscleGroup, equipment."}
                      </p>
                    </div>

                    <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                      <Upload className="h-4 w-4" />
                      {locale === "en" ? "Open importer" : "Mở trình import"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{locale === "en" ? "Exercise groups" : "Nhóm bài tập"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {locale === "en"
                          ? `${formatNumber(groupedExercises.length, locale)} muscle groups • ${formatNumber(filteredExercises.length, locale)} exercises • ${formatNumber(totalExerciseUsageCount, locale)} workout references`
                          : `${formatNumber(groupedExercises.length, locale)} nhóm cơ • ${formatNumber(filteredExercises.length, locale)} bài tập • ${formatNumber(totalExerciseUsageCount, locale)} lượt dùng trong workout`}
                      </p>
                    </div>

                    <div className="relative w-full sm:max-w-sm">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} placeholder={locale === "en" ? "Search exercises..." : "Tìm bài tập..."} className="pl-9" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {groupedExercises.length ? (
                    groupedExercises.map((group) => {
                      const isOpen = shouldAutoExpandExerciseGroups || openExerciseGroups.includes(group.groupKey)

                      return (
                        <div key={group.groupKey} className="overflow-hidden rounded-2xl border border-border bg-card">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/20"
                            onClick={() =>
                              setOpenExerciseGroups((currentGroups) =>
                                currentGroups.includes(group.groupKey)
                                  ? currentGroups.filter((currentGroup) => currentGroup !== group.groupKey)
                                  : [...currentGroups, group.groupKey],
                              )
                            }
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="mt-0.5 rounded-full border border-border bg-muted/30 p-1">
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold">{group.muscleGroup}</h3>
                                  <Badge variant="outline">
                                    {formatNumber(group.exercises.length, locale)} {locale === "en" ? "exercises" : "bài tập"}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {formatNumber(group.totalUsageCount, locale)}{" "}
                                  {locale === "en" ? "total workout references" : "tổng lượt dùng trong workout"}
                                </p>
                              </div>
                            </div>

                            <span className="shrink-0 text-xs text-muted-foreground">
                              {isOpen ? (locale === "en" ? "Collapse" : "Thu gọn") : locale === "en" ? "Expand" : "Mở rộng"}
                            </span>
                          </button>

                          {isOpen ? (
                            <div className="border-t border-border bg-muted/10 p-4">
                              <div className="space-y-3">
                                {group.exercises.map((exercise) => (
                                  <div key={exercise.id} className="rounded-xl border border-border bg-card p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div>
                                        <h4 className="font-semibold">{exercise.name}</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {exercise.equipment ?? (locale === "en" ? "No equipment" : "Không có thiết bị")}
                                        </p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                          {formatNumber(exercise.usageCount, locale)}{" "}
                                          {locale === "en" ? "workout references" : "lần được dùng trong workout"}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            setExerciseForm({
                                              equipment: exercise.equipment ?? "",
                                              id: exercise.id,
                                              muscleGroup: exercise.muscleGroup,
                                              name: exercise.name,
                                            })
                                          }
                                        >
                                          {locale === "en" ? "Edit" : "Sửa"}
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => setConfirmState({ id: exercise.id, kind: "exercise", label: exercise.name })}>
                                          <Trash2 className="h-4 w-4" />
                                          {locale === "en" ? "Delete" : "Xoá"}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  ) : (
                    <EmptyState copy={locale === "en" ? "No exercises match the current search." : "Không có bài tập nào khớp tìm kiếm hiện tại."} />
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder={locale === "en" ? "Search audit logs..." : "Tìm audit log..."} className="pl-9" />
              </div>
              <Select value={auditEntityType} onValueChange={setAuditEntityType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{locale === "en" ? "All entities" : "Tất cả entity"}</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="coach_request">coach_request</SelectItem>
                  <SelectItem value="connection">connection</SelectItem>
                  <SelectItem value="program">program</SelectItem>
                  <SelectItem value="exercise">exercise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {filteredAuditLogs.length ? (
                filteredAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.entityType}</Badge>
                          <p className="font-medium">{log.action}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{log.entityLabel ?? (locale === "en" ? "No label" : "Không có nhãn")}</p>
                        <p className="text-sm text-muted-foreground">{log.admin.name} • {log.admin.email}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{formatDateTime(log.createdAt, locale)}</p>
                      </div>
                    </div>
                    {log.metadata ? (
                      <Textarea readOnly value={JSON.stringify(log.metadata, null, 2)} className="mt-4 min-h-[96px] font-mono text-xs" />
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState copy={locale === "en" ? "No audit logs match the current filters." : "Không có audit log nào khớp bộ lọc hiện tại."} />
              )}
            </div>
          </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={handleImportDialogChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{locale === "en" ? "Import exercises from Excel" : "Import bài tập từ Excel"}</DialogTitle>
            <DialogDescription>
              {locale === "en"
                ? "Supported files: .xlsx, .xls, .csv. Required columns: name and muscle group. Optional: equipment."
                : "Hỗ trợ file .xlsx, .xls, .csv. Cột bắt buộc: name và muscle group. Cột tuỳ chọn: equipment."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
              <Label htmlFor="exercise-import-file">{locale === "en" ? "Select file" : "Chọn file"}</Label>
              <Input
                key={importInputKey}
                id="exercise-import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-2"
                onChange={(event) => void handleImportFileChange(event)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {locale === "en"
                  ? "Accepted header aliases include: name/exercise, muscleGroup/bodyPart, equipment/gear."
                  : "Header có thể dùng các tên tương đương như: name/exercise, muscleGroup/bodyPart, equipment/gear."}
              </p>
            </div>

            {importFileName ? (
              <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{locale === "en" ? "File" : "File"}</p>
                  <p className="mt-1 truncate text-sm font-medium">{importFileName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Valid rows" : "Dòng hợp lệ"}</p>
                  <p className="mt-1 text-sm font-medium">{formatNumber(importRows.length, locale)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Issues" : "Lỗi"}</p>
                  <p className="mt-1 text-sm font-medium">{formatNumber(importIssues.length, locale)}</p>
                </div>
              </div>
            ) : null}

            {actionKey === "exercise-import-parse" ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{locale === "en" ? "Reading file..." : "Đang đọc file..."}</span>
              </div>
            ) : null}

            {importIssues.length ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <h4 className="text-sm font-semibold">{locale === "en" ? "Validation issues" : "Lỗi cần sửa"}</h4>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {importIssues.slice(0, 8).map((issue, index) => (
                    <p key={`${issue.rowNumber ?? "general"}-${index}`}>
                      {issue.rowNumber ? `${locale === "en" ? "Row" : "Dòng"} ${issue.rowNumber}: ` : ""}
                      {issue.message}
                    </p>
                  ))}
                  {importIssues.length > 8 ? (
                    <p>{locale === "en" ? `+${importIssues.length - 8} more issues` : `+${importIssues.length - 8} lỗi khác`}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {importPreviewRows.length ? (
              <div className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h4 className="text-sm font-semibold">{locale === "en" ? "Preview" : "Xem trước"}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {locale === "en"
                      ? "The first rows below will be created as shared exercises."
                      : "Các dòng đầu tiên dưới đây sẽ được tạo thành bài tập dùng chung."}
                  </p>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">{locale === "en" ? "Row" : "Dòng"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Name" : "Tên bài tập"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Muscle group" : "Nhóm cơ"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Equipment" : "Thiết bị"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.name}`} className="border-t border-border">
                          <td className="px-4 py-2 text-muted-foreground">{row.rowNumber}</td>
                          <td className="px-4 py-2 font-medium">{row.name}</td>
                          <td className="px-4 py-2">{row.muscleGroup}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.equipment ?? (locale === "en" ? "No equipment" : "Không có thiết bị")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > importPreviewRows.length ? (
                  <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    {locale === "en"
                      ? `Showing ${importPreviewRows.length} of ${importRows.length} valid rows.`
                      : `Đang hiển thị ${importPreviewRows.length}/${importRows.length} dòng hợp lệ.`}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleImportDialogChange(false)} disabled={actionKey === "exercise-import"}>
              {locale === "en" ? "Cancel" : "Huỷ"}
            </Button>
            <Button onClick={() => void handleImportExercises()} disabled={actionKey === "exercise-import" || !importRows.length || importIssues.length > 0}>
              {actionKey === "exercise-import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {locale === "en" ? "Import exercises" : "Import bài tập"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmState)} onOpenChange={(open) => setConfirmState(open ? confirmState : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "en" ? "Confirm action" : "Xác nhận thao tác"}</DialogTitle>
            <DialogDescription>
              {locale === "en" ? "You are about to remove or delete this item:" : "Bạn sắp xoá hoặc gỡ mục sau:"}
              <span className="mt-2 block font-medium text-foreground">{confirmState?.label}</span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmState(null)}>
              {locale === "en" ? "Cancel" : "Huỷ"}
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmAction()} disabled={Boolean(actionKey?.startsWith("confirm-"))}>
              {actionKey?.startsWith("confirm-") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {locale === "en" ? "Confirm" : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
