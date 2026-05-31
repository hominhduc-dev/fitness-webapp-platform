"use client"

import {
  Activity,
  ClipboardList,
  Download,
  Dumbbell,
  KeyRound,
  LayoutDashboard,
  Link2,
  Loader2,
  Save,
  Search,
  ScrollText,
  Trash2,
  Upload,
  UserRoundCheck,
  Users,
} from "lucide-react"
import { useEffect, useState, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { AdminExercisesPanel, type ExerciseSaveData } from "@/components/admin/admin-exercises-panel"
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
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  assignAdminCoachConnection,
  createAdminExerciseRequest,
  deleteAdminCoachRequestRequest,
  deleteAdminExerciseGroupRequest,
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
import { formatExerciseVariationLabel, formatExerciseVariationMeta } from "@/lib/exercise-display"
import type { UserRole } from "@/lib/types"

type ConfirmState =
  | {
      id: string
      kind: "connection" | "exercise" | "exercise-group" | "program" | "request"
      label: string
    }
  | {
      id: string
      kind: "exercise-groups"
      label: string
      muscleGroups: string[]
    }
  | null

type ExerciseFormState = {
  equipment: string
  id?: string
  muscleGroup: string
  name: string
  variationName: string
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
  exerciseName: [
    "exercise name",
    "exercise_name",
    "exercise",
    "name",
    "ten bai tap",
    "ten",
  ],
  equipment: ["equipment", "gear", "device", "dung cu", "thiet bi"],
  isDefault: ["is default", "is_default", "default", "mac dinh"],
  muscleGroup: ["muscle group", "musclegroup", "muscle_group", "body part", "bodypart", "nhom co"],
  sortOrder: ["sort order", "sort_order", "order", "thu tu"],
  variationName: ["variation name", "variation_name", "variation", "bien the"],
} as const

const EXERCISE_TEMPLATE_MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
  "Glutes",
  "Calves",
  "Cardio",
  "Full Body",
] as const

const EXERCISE_TEMPLATE_EQUIPMENT = [
  "Barbell",
  "Dumbbell",
  "Kettlebell",
  "Cable",
  "Machine",
  "Bodyweight",
  "Resistance Band",
  "EZ Bar",
  "Smith Machine",
  "Pull-up Bar",
  "Bench",
  "Medicine Ball",
  "TRX",
  "Other",
] as const

const EXERCISE_TEMPLATE_EXAMPLES = [
  ["Bench Press", "Chest", "Default", "Barbell", "TRUE", 0],
  ["Bench Press", "Chest", "Incline", "Dumbbell", "FALSE", 1],
  ["Lat Pulldown", "Back", "Wide Grip", "Cable", "TRUE", 0],
  ["Plank", "Core", "Default", "Bodyweight", "TRUE", 0],
] as const

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
  const normalizedValue = normalizeImportHeader(value)
  return ["1", "true", "yes", "y", "x"].includes(normalizedValue)
}

function parseImportNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : undefined
}

function getExerciseGroupKey(value?: string | null) {
  const normalizedValue = value?.trim().toLowerCase()
  return normalizedValue ? normalizedValue : "__other__"
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
    <div className="rounded-[10px] border border-border bg-card p-[18px] transition-colors duration-150 hover:border-primary/30">
      <p className="text-[15px] font-semibold text-foreground">{title}</p>
      <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>

      <div className="flex h-[132px] items-end gap-2">
        {points.map((point, index) => {
          const height = point.value === 0 ? 3 : Math.max((point.value / maxValue) * 110, 8)
          const isCurrent = index === points.length - 1

          return (
            <div key={`${point.label}-${point.value}`} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground tnum">
                {point.value >= 1000 ? `${(point.value / 1000).toFixed(1)}k` : point.value}
              </span>
              <div
                className={`w-full rounded-[4px] ${isCurrent ? "bg-primary" : "bg-muted"}`}
                style={{ height: `${height}px` }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                {point.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ copy }: { copy: string }) {
  return <div className="rounded-[10px] border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">{copy}</div>
}

type AdminSectionId = "dashboard" | "users" | "requests" | "connections" | "programs" | "exercises" | "audit"

type AdminSectionItem = {
  badge?: number
  icon: typeof LayoutDashboard
  id: AdminSectionId
  label: string
}

function AdminShellHeader({
  activeSection,
  auditCount,
  connectionCount,
  exerciseCount,
  locale,
  pendingRequestCount,
  programCount,
  stats,
  userCount,
}: {
  activeSection: AdminSectionId
  auditCount: number
  connectionCount: number
  exerciseCount: number
  locale: "en" | "vi"
  pendingRequestCount: number
  programCount: number
  stats?: AdminDashboardData["stats"]
  userCount: number
}) {
  const totalUsers = stats?.totalUsers ?? userCount

  const copy: Record<AdminSectionId, { label: string; title: string; sub: string }> = {
    audit: {
      label: locale === "en" ? "Audit" : "Audit",
      title: locale === "en" ? "Activity log." : "Nhật ký hoạt động.",
      sub:
        locale === "en"
          ? `${formatNumber(auditCount, locale)} recent admin actions`
          : `${formatNumber(auditCount, locale)} thao tác admin gần đây`,
    },
    connections: {
      label: locale === "en" ? "Connections" : "Kết nối",
      title:
        locale === "en"
          ? `${formatNumber(connectionCount, locale)} active.`
          : `${formatNumber(connectionCount, locale)} kết nối.`,
      sub:
        locale === "en"
          ? `${formatNumber(pendingRequestCount, locale)} pending coach requests`
          : `${formatNumber(pendingRequestCount, locale)} yêu cầu coach chờ duyệt`,
    },
    dashboard: {
      label: locale === "en" ? "Overview" : "Tổng quan",
      title: locale === "en" ? "System health." : "Sức khoẻ hệ thống.",
      sub:
        locale === "en"
          ? `${formatNumber(totalUsers, locale)} users · ${formatNumber(stats?.totalCoaches ?? 0, locale)} coaches · ${formatNumber(stats?.activeUsersLast7Days ?? 0, locale)} active this week`
          : `${formatNumber(totalUsers, locale)} user · ${formatNumber(stats?.totalCoaches ?? 0, locale)} coach · ${formatNumber(stats?.activeUsersLast7Days ?? 0, locale)} hoạt động tuần này`,
    },
    exercises: {
      label: locale === "en" ? "Library" : "Thư viện",
      title:
        locale === "en"
          ? `${formatNumber(exerciseCount, locale)} exercises.`
          : `${formatNumber(exerciseCount, locale)} bài tập.`,
      sub: locale === "en" ? "Grouped exercise variations" : "Các variation bài tập theo nhóm cơ",
    },
    programs: {
      label: locale === "en" ? "Programs" : "Giáo án",
      title:
        locale === "en"
          ? `${formatNumber(programCount, locale)} authored.`
          : `${formatNumber(programCount, locale)} giáo án.`,
      sub: locale === "en" ? "System-wide program oversight" : "Theo dõi giáo án toàn hệ thống",
    },
    requests: {
      label: locale === "en" ? "Coach requests" : "Yêu cầu coach",
      title:
        locale === "en"
          ? `${formatNumber(pendingRequestCount, locale)} pending.`
          : `${formatNumber(pendingRequestCount, locale)} chờ duyệt.`,
      sub: locale === "en" ? "Review trainee-to-coach requests" : "Duyệt yêu cầu kết nối trainee với coach",
    },
    users: {
      label: locale === "en" ? "Users" : "Người dùng",
      title:
        locale === "en"
          ? `${formatNumber(userCount, locale)} accounts.`
          : `${formatNumber(userCount, locale)} tài khoản.`,
      sub:
        locale === "en"
          ? `${formatNumber(stats?.totalCoaches ?? 0, locale)} coaches · ${formatNumber(stats?.totalAdmins ?? 0, locale)} admins`
          : `${formatNumber(stats?.totalCoaches ?? 0, locale)} coach · ${formatNumber(stats?.totalAdmins ?? 0, locale)} admin`,
    },
  }

  const activeCopy = copy[activeSection]

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="label-micro mb-2">{activeCopy.label}</p>
        <h1 className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground md:text-[34px]">
          {activeCopy.title}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground tnum">{activeCopy.sub}</p>
      </div>
    </div>
  )
}


function AdminConsoleLoadingState({ locale }: { locale: "en" | "vi" }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="rounded-[10px] border border-border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-9 w-28" />
            <Skeleton className="mt-2 h-4 w-36" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-[10px] border border-border bg-card p-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-2 h-4 w-48 max-w-full" />
            <div className="mt-6 flex h-44 items-end gap-2">
              {Array.from({ length: 6 }, (_, barIndex) => (
                <div key={barIndex} className="flex flex-1 flex-col items-center gap-2">
                  <Skeleton className="h-3 w-8" />
                  <Skeleton className="w-full rounded-[4px]" style={{ height: `${35 + barIndex * 8}%` }} />
                  <Skeleton className="h-3 w-6" />
                </div>
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
    </div>
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
    variationName: "",
  })
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState<UserRole | "all">("all")
  const [requestSearch, setRequestSearch] = useState("")
  const [requestStatusFilter, setRequestStatusFilter] = useState<AdminCoachRequest["status"] | "all">("all")
  const [connectionSearch, setConnectionSearch] = useState("")
  const [programSearch, setProgramSearch] = useState("")
  const [exerciseSearch, setExerciseSearch] = useState("")
  const [openExerciseGroups, setOpenExerciseGroups] = useState<string[]>([])
  const [selectedExerciseGroupKeys, setSelectedExerciseGroupKeys] = useState<string[]>([])
  const [auditSearch, setAuditSearch] = useState("")
  const [auditEntityType, setAuditEntityType] = useState("all")
  const [chartView, setChartView] = useState<"weekly" | "monthly">("weekly")
  const router = useRouter()
  const searchParams = useSearchParams()
  const sectionFromUrl = (searchParams.get("s") ?? "dashboard") as AdminSectionId
  const VALID_SECTIONS: AdminSectionId[] = ["dashboard", "users", "requests", "connections", "programs", "exercises", "audit"]
  const [activeSection, setActiveSectionState] = useState<AdminSectionId>(
    VALID_SECTIONS.includes(sectionFromUrl) ? sectionFromUrl : "dashboard"
  )

  // Sync URL → state when user navigates via sidebar
  useEffect(() => {
    const next = VALID_SECTIONS.includes(sectionFromUrl) ? sectionFromUrl : "dashboard"
    if (next !== activeSection) setActiveSectionState(next)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionFromUrl])

  // State setter that also pushes URL
  function setActiveSection(section: AdminSectionId) {
    setActiveSectionState(section)
    const url = section === "dashboard" ? "/admin" : `/admin?s=${section}`
    router.replace(url, { scroll: false })
  }
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

  /**
   * Lightweight refresh for exercise mutations.
   * Exercise create/update/delete only affect the exercise list (+ audit log),
   * so refetch just those two instead of the whole admin console (8 queries).
   */
  async function refreshExercises() {
    if (!session?.access_token) {
      return
    }

    const token = session.access_token

    try {
      const [nextExercises, nextAuditLogs] = await Promise.all([
        fetchAdminExercises(token),
        fetchAdminAuditLogs(token).catch(() => auditLogs), // audit is non-critical
      ])
      setExercises(nextExercises)
      setAuditLogs(nextAuditLogs)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Không thể tải danh sách bài tập.")
    }
  }

  function resetExerciseForm() {
    setExerciseForm({
      equipment: "",
      muscleGroup: "",
      name: "",
      variationName: "",
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

  async function handleDownloadExerciseTemplate() {
    setActionKey("exercise-template-download")
    setError(null)
    setNotice(null)

    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.utils.book_new()
      const templateHeaders = ["exercise_name", "muscle_group", "variation_name", "equipment", "is_default", "sort_order"]
      const instructionsSheet = XLSX.utils.aoa_to_sheet([
        [locale === "en" ? "Exercise import template" : "Mẫu import bài tập"],
        [
          locale === "en"
            ? "Use the Exercises sheet to fill in data before uploading back to the system."
            : "Dùng sheet Exercises để nhập dữ liệu trước khi tải ngược lên hệ thống.",
        ],
        [
          locale === "en"
            ? "Each row represents one exercise variation. Required columns: exercise_name, muscle_group, variation_name."
            : "Mỗi dòng là một variation của bài tập. Cột bắt buộc: exercise_name, muscle_group, variation_name.",
        ],
        [
          locale === "en"
            ? "Use the same exercise_name + muscle_group on multiple rows when one base exercise has several variations."
            : "Dùng cùng exercise_name + muscle_group trên nhiều dòng nếu một bài gốc có nhiều variation.",
        ],
        [
          locale === "en"
            ? "Set exactly one row per exercise as is_default = TRUE. If there is only one variation, use variation_name = Default."
            : "Mỗi bài nên có đúng một dòng is_default = TRUE. Nếu chỉ có một variation, dùng variation_name = Default.",
        ],
        [
          locale === "en"
            ? "equipment is optional. sort_order controls display order and defaults to 0 if left blank."
            : "equipment là tuỳ chọn. sort_order quyết định thứ tự hiển thị và mặc định là 0 nếu bỏ trống.",
        ],
      ])
      const exercisesSheet = XLSX.utils.aoa_to_sheet([templateHeaders])
      const examplesSheet = XLSX.utils.aoa_to_sheet([
        templateHeaders,
        ...EXERCISE_TEMPLATE_EXAMPLES.map((row) => [...row]),
      ])
      const referenceRows = [
        ["muscle_group", "equipment"],
        ...Array.from(
          { length: Math.max(EXERCISE_TEMPLATE_MUSCLE_GROUPS.length, EXERCISE_TEMPLATE_EQUIPMENT.length) },
          (_, index) => [EXERCISE_TEMPLATE_MUSCLE_GROUPS[index] ?? "", EXERCISE_TEMPLATE_EQUIPMENT[index] ?? ""],
        ),
      ]
      const referenceSheet = XLSX.utils.aoa_to_sheet(referenceRows)

      instructionsSheet["!cols"] = [{ wch: 110 }]
      exercisesSheet["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 12 }]
      examplesSheet["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 12 }]
      referenceSheet["!cols"] = [{ wch: 22 }, { wch: 22 }]

      XLSX.utils.book_append_sheet(workbook, exercisesSheet, "Exercises")
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions")
      XLSX.utils.book_append_sheet(workbook, examplesSheet, "Examples")
      XLSX.utils.book_append_sheet(workbook, referenceSheet, "Reference")

      XLSX.writeFile(workbook, locale === "en" ? "exercise-import-template.xlsx" : "mau-import-bai-tap.xlsx")

      setNotice(locale === "en" ? "Exercise import template downloaded." : "Đã tải file mẫu import bài tập.")
    } catch (templateError) {
      setError(
        templateError instanceof Error
          ? templateError.message
          : locale === "en"
            ? "Unable to generate the Excel template."
            : "Không thể tạo file mẫu Excel.",
      )
    } finally {
      setActionKey(null)
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

      if (!workbook.SheetNames.length) {
        throw new Error(locale === "en" ? "The selected file has no worksheets." : "File được chọn không có worksheet nào.")
      }

      const worksheets = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<Array<string | number | null | undefined>>(sheet, {
          blankrows: false,
          defval: "",
          header: 1,
          raw: false,
        })

        const headerRow = rows[0] ?? []
        const columnMap = headerRow.reduce<Partial<Record<keyof typeof EXERCISE_IMPORT_HEADERS, number>>>((result, cell, index) => {
          const column = resolveImportColumn(cell)

          if (column && typeof result[column] !== "number") {
            result[column] = index
          }

          return result
        }, {})

        return {
          columnMap,
          rows,
          sheetName,
        }
      })

      const worksheet =
        worksheets.find((item) => item.sheetName.trim().toLowerCase() === "exercises") ??
        worksheets.find(
          (item) => typeof item.columnMap.exerciseName === "number" && typeof item.columnMap.muscleGroup === "number",
        )

      if (!worksheet || !worksheet.rows.length) {
        throw new Error(locale === "en" ? "The selected file is empty." : "File được chọn đang trống.")
      }

      const { columnMap, rows } = worksheet
      const missingColumns = [
        typeof columnMap.exerciseName !== "number" ? (locale === "en" ? "exercise_name" : "exercise_name") : null,
        typeof columnMap.muscleGroup !== "number" ? (locale === "en" ? "muscle_group" : "muscle_group") : null,
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

        if (isBlankRow) {
          return
        }

        if (!exerciseName || !muscleGroup) {
          nextIssues.push({
            message:
              locale === "en"
                ? "Missing exercise_name or muscle_group."
                : "Thiếu exercise_name hoặc muscle_group.",
            rowNumber,
          })
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
      await refreshExercises()
    } catch (exerciseError) {
      setError(exerciseError instanceof Error ? exerciseError.message : "Không thể lưu bài tập.")
    } finally {
      setActionKey(null)
    }
  }

  // Panel-facing handlers (accept data directly, no internal exerciseForm state needed)
  async function handleSaveExerciseData(data: ExerciseSaveData) {
    if (!session?.access_token) return
    setActionKey(data.id ? `exercise-update-${data.id}` : "exercise-create")
    setError(null)
    setNotice(null)
    try {
      if (data.id) {
        await updateAdminExerciseRequest(session.access_token, data.id, data)
        setNotice(locale === "en" ? "Exercise updated." : "Đã cập nhật bài tập.")
      } else {
        await createAdminExerciseRequest(session.access_token, data)
        setNotice(locale === "en" ? "Exercise created." : "Đã tạo bài tập mới.")
      }
      await refreshExercises()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu bài tập.")
      throw err
    } finally {
      setActionKey(null)
    }
  }

  async function handleDeleteExerciseDirect(exercise: AdminExerciseItem) {
    if (!session?.access_token) return
    setError(null)
    setNotice(null)
    try {
      await deleteAdminExerciseRequest(session.access_token, exercise.id)
      setNotice(locale === "en" ? "Exercise deleted." : "Đã xóa bài tập.")
      await refreshExercises()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa bài tập.")
      throw err
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
          ? `Imported ${result.createdCount} exercise variations and skipped ${result.skippedCount} rows.`
          : `Đã import ${result.createdCount} variation bài tập và bỏ qua ${result.skippedCount} dòng.`,
      )
      await refreshExercises()
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
      let nextNotice = locale === "en" ? "Action completed successfully." : "Đã thực hiện thao tác thành công."

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
        nextNotice = locale === "en" ? "Exercise deleted." : "Đã xóa bài tập."
      }

      if (confirmState.kind === "exercise-group") {
        const result = await deleteAdminExerciseGroupRequest(session.access_token, confirmState.id)

        if (exerciseForm.id && result.deletedIds.includes(exerciseForm.id)) {
          resetExerciseForm()
        }

        setSelectedExerciseGroupKeys((currentKeys) =>
          currentKeys.filter((groupKey) => groupKey !== getExerciseGroupKey(result.muscleGroup)),
        )

        if (result.deletedCount === 0 && result.skippedCount > 0) {
          nextNotice =
            locale === "en"
              ? `No exercises were deleted from ${result.muscleGroup} because all of them are already used in workouts.`
              : `Không xóa được bài tập nào trong nhóm ${result.muscleGroup} vì tất cả đang được dùng trong workout.`
        } else if (result.skippedCount > 0) {
          nextNotice =
            locale === "en"
              ? `Deleted ${result.deletedCount} exercises from ${result.muscleGroup} and skipped ${result.skippedCount} in-use exercises.`
              : `Đã xóa ${result.deletedCount} bài tập trong nhóm ${result.muscleGroup} và bỏ qua ${result.skippedCount} bài tập đang được dùng.`
        } else {
          nextNotice =
            locale === "en"
              ? `Deleted ${result.deletedCount} exercises from ${result.muscleGroup}.`
              : `Đã xóa ${result.deletedCount} bài tập trong nhóm ${result.muscleGroup}.`
        }
      }

      if (confirmState.kind === "exercise-groups") {
        const results = await Promise.all(
          confirmState.muscleGroups.map((muscleGroup) =>
            deleteAdminExerciseGroupRequest(session.access_token as string, muscleGroup),
          ),
        )
        const deletedCount = results.reduce((sum, result) => sum + result.deletedCount, 0)
        const skippedCount = results.reduce((sum, result) => sum + result.skippedCount, 0)

        if (exerciseForm.id && results.some((result) => result.deletedIds.includes(exerciseForm.id as string))) {
          resetExerciseForm()
        }

        setSelectedExerciseGroupKeys([])

        if (deletedCount === 0 && skippedCount > 0) {
          nextNotice =
            locale === "en"
              ? `No exercises were deleted from the ${results.length} selected muscle groups because they are already used in workouts.`
              : `Không xóa được bài tập nào trong ${results.length} nhóm cơ đã chọn vì các bài tập này đang được dùng trong workout.`
        } else if (skippedCount > 0) {
          nextNotice =
            locale === "en"
              ? `Deleted ${deletedCount} exercises from ${results.length} selected muscle groups and skipped ${skippedCount} in-use exercises.`
              : `Đã xóa ${deletedCount} bài tập trong ${results.length} nhóm cơ đã chọn và bỏ qua ${skippedCount} bài tập đang được dùng.`
        } else {
          nextNotice =
            locale === "en"
              ? `Deleted ${deletedCount} exercises from ${results.length} selected muscle groups.`
              : `Đã xóa ${deletedCount} bài tập trong ${results.length} nhóm cơ đã chọn.`
        }
      }

      if (confirmState.kind === "connection") {
        await removeAdminCoachConnection(session.access_token, confirmState.id)
      }

      // Exercise/exercise-group deletes only touch the exercise list (+ audit),
      // so use the lightweight refresh. Other entities (program/connection/request)
      // affect dashboard counts and need the full refresh.
      const exerciseOnlyKinds = ["exercise", "exercise-group", "exercise-groups"]
      const useLightRefresh = exerciseOnlyKinds.includes(confirmState.kind)

      setConfirmState(null)
      if (useLightRefresh) {
        await refreshExercises()
      } else {
        await refreshAllData(session.access_token, selectedUserId, true)
      }
      setNotice(nextNotice)
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
    matchesSearch(
      [exercise.name, exercise.variationName, exercise.muscleGroup, exercise.equipment, exercise.createdBy?.name],
      exerciseSearch,
    ),
  )
  const groupedExercisesMap = new Map<string, ExerciseGroupItem>()
  const sortedExercises = [...filteredExercises].sort((left, right) => {
    const language = locale === "vi" ? "vi" : "en"
    const groupComparison = left.muscleGroup.localeCompare(right.muscleGroup, language, { sensitivity: "base" })

    if (groupComparison !== 0) {
      return groupComparison
    }

    const nameComparison = left.name.localeCompare(right.name, language, { sensitivity: "base" })

    if (nameComparison !== 0) {
      return nameComparison
    }

    const defaultComparison = Number(right.isDefault) - Number(left.isDefault)

    if (defaultComparison !== 0) {
      return defaultComparison
    }

    return left.variationName.localeCompare(right.variationName, language, { sensitivity: "base" })
  })

  for (const exercise of sortedExercises) {
    const muscleGroup = exercise.muscleGroup.trim() || (locale === "en" ? "Other" : "Khác")
    const groupKey = getExerciseGroupKey(muscleGroup)
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
  const visibleExerciseGroupKeys = groupedExercises.map((group) => group.groupKey)
  const visibleExerciseGroupKeySignature = visibleExerciseGroupKeys.join("|")
  const shouldAutoExpandExerciseGroups = exerciseSearch.trim().length > 0
  const totalExerciseUsageCount = groupedExercises.reduce((sum, group) => sum + group.totalUsageCount, 0)
  const selectedExerciseGroups = groupedExercises.filter((group) => selectedExerciseGroupKeys.includes(group.groupKey))
  const selectedExerciseGroupCount = selectedExerciseGroups.length
  const selectAllExerciseGroupsState =
    selectedExerciseGroupCount === 0
      ? false
      : selectedExerciseGroupCount === groupedExercises.length
        ? true
        : "indeterminate"

  useEffect(() => {
    const visibleGroupKeySet = new Set(visibleExerciseGroupKeys)

    setSelectedExerciseGroupKeys((currentKeys) => {
      const nextKeys = currentKeys.filter((groupKey) => visibleGroupKeySet.has(groupKey))
      return nextKeys.length === currentKeys.length ? currentKeys : nextKeys
    })
  }, [visibleExerciseGroupKeySignature])

  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesEntityType = auditEntityType === "all" ? true : log.entityType === auditEntityType
    return matchesEntityType && matchesSearch([log.action, log.entityType, log.entityLabel, log.admin.name], auditSearch)
  })
  const exerciseMuscleGroupOptions = Array.from(
    new Map(
      [...EXERCISE_TEMPLATE_MUSCLE_GROUPS, ...exercises.map((exercise) => exercise.muscleGroup), exerciseForm.muscleGroup]
        .map((muscleGroup) => muscleGroup?.trim())
        .filter((muscleGroup): muscleGroup is string => Boolean(muscleGroup))
        .map((muscleGroup) => [muscleGroup.toLowerCase(), muscleGroup]),
    ).values(),
  ).sort((left, right) => left.localeCompare(right, locale === "vi" ? "vi" : "en", { sensitivity: "base" }))
  const isExerciseGroupDelete =
    confirmState?.kind === "exercise-group" || confirmState?.kind === "exercise-groups"
  const isBulkExerciseGroupDelete = confirmState?.kind === "exercise-groups"
  const confirmDialogTitle = isBulkExerciseGroupDelete
    ? locale === "en"
      ? "Delete selected muscle groups"
      : "Xóa các nhóm cơ đã chọn"
    : isExerciseGroupDelete
      ? locale === "en"
        ? "Delete exercise group"
        : "Xóa nhóm bài tập"
      : locale === "en"
        ? "Confirm action"
        : "Xác nhận thao tác"
  const confirmDialogDescription = isBulkExerciseGroupDelete
    ? locale === "en"
      ? "This will delete all exercises inside the selected muscle groups. Exercises already used in workouts will be skipped."
      : "Thao tác này sẽ xóa toàn bộ bài tập trong các nhóm cơ đã chọn. Các bài tập đang được dùng trong workout sẽ được bỏ qua."
    : isExerciseGroupDelete
      ? locale === "en"
        ? "This will delete all exercises in this muscle group. Exercises already used in workouts will be skipped."
        : "Thao tác này sẽ xóa toàn bộ bài tập trong nhóm cơ này. Các bài tập đang được dùng trong workout sẽ được bỏ qua."
      : locale === "en"
        ? "You are about to remove or delete this item:"
        : "Bạn sắp xoá hoặc gỡ mục sau:"
  const confirmDialogActionLabel = isBulkExerciseGroupDelete
    ? locale === "en"
      ? "Delete selected"
      : "Xóa đã chọn"
    : isExerciseGroupDelete
      ? locale === "en"
        ? "Delete group"
        : "Xóa nhóm"
      : locale === "en"
        ? "Confirm"
        : "Xác nhận"
  const isConsolePending = !session?.access_token || isLoading
  const pendingRequestCount = coachRequests.filter((request) => request.status === "pending").length
  const adminNavItems: AdminSectionItem[] = [
    { icon: LayoutDashboard, id: "dashboard", label: "Dashboard" },
    { icon: Users, id: "users", label: "Users" },
    { badge: pendingRequestCount || undefined, icon: UserRoundCheck, id: "requests", label: "Coach Requests" },
    { icon: Link2, id: "connections", label: "Connections" },
    { icon: ClipboardList, id: "programs", label: "Programs" },
    { icon: Dumbbell, id: "exercises", label: "Exercises" },
    { icon: ScrollText, id: "audit", label: "Audit" },
  ]

  return (
    <>
      <main className="min-w-0">
          <div className="space-y-6 px-4 py-6 md:px-9 md:py-8">
            <AdminShellHeader
              activeSection={activeSection}
              auditCount={auditLogs.length}
              connectionCount={connections?.connections.length ?? 0}
              exerciseCount={exercises.length}
              locale={locale}
              pendingRequestCount={pendingRequestCount}
              programCount={programs.length}
              stats={dashboard?.stats}
              userCount={users.length}
            />

            <div className="min-h-[42px]">
              {error ? (
                <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              {!error && notice ? (
                <div className="rounded-[10px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                  {notice}
                </div>
              ) : null}
            </div>

            {isConsolePending ? (
              <AdminConsoleLoadingState locale={locale} />
            ) : (
              <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as AdminSectionId)}>

          <TabsContent value="dashboard" className="space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              {([
                { label: locale === "en" ? "Total users" : "Tổng user", value: dashboard?.stats.totalUsers ?? 0, sub: locale === "en" ? "all roles" : "mọi vai trò" },
                { label: locale === "en" ? "Coaches" : "Coaches", value: dashboard?.stats.totalCoaches ?? 0, sub: locale === "en" ? "coach accounts" : "tài khoản coach" },
                { label: locale === "en" ? "Trainees" : "Trainees", value: dashboard?.stats.totalTrainees ?? 0, sub: locale === "en" ? "fitness users" : "người dùng fitness" },
                { label: locale === "en" ? "Active 7d" : "Active 7d", value: dashboard?.stats.activeUsersLast7Days ?? 0, sub: locale === "en" ? "activity in 7 days" : "hoạt động 7 ngày" },
                { label: locale === "en" ? "Active 30d" : "Active 30d", value: dashboard?.stats.activeUsersLast30Days ?? 0, sub: locale === "en" ? "activity in 30 days" : "hoạt động 30 ngày", accent: true },
              ] as const).map((card) => (
                <div key={card.label} className="rounded-[10px] border border-border bg-card p-[18px]">
                  <p className="label-micro text-muted-foreground">{card.label}</p>
                  <div className={`mt-2 font-mono text-[30px] font-semibold leading-none tracking-[-0.02em] tnum ${"accent" in card && card.accent ? "text-primary" : "text-foreground"}`}>
                    {card.value.toLocaleString()}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Chart toggle + label */}
            <div className="flex items-center justify-between">
              <p className="label-micro text-muted-foreground">{locale === "en" ? "Platform charts" : "Biểu đồ nền tảng"}</p>
              <div className="flex gap-1.5">
                {(["weekly", "monthly"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setChartView(view)}
                    className={`rounded-[5px] px-3 py-1 font-mono text-[11px] transition-colors ${
                      chartView === view
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {view === "weekly" ? (locale === "en" ? "Weekly" : "Theo tuần") : (locale === "en" ? "Monthly" : "Theo tháng")}
                  </button>
                ))}
              </div>
            </div>

            {/* 3 bar charts */}
            <div className="grid gap-3 xl:grid-cols-3">
              <ChartPanel title={locale === "en" ? "User growth" : "Tăng trưởng user"} subtitle={locale === "en" ? "New accounts" : "Tài khoản mới"} points={dashboard?.charts.userGrowth[chartView] ?? []} />
              <ChartPanel title={locale === "en" ? "Active users" : "Người dùng hoạt động"} subtitle={locale === "en" ? "With workout/meal activity" : "Có workout/meal activity"} points={dashboard?.charts.activeUsers[chartView] ?? []} />
              <ChartPanel title={locale === "en" ? "Workout logs" : "Workout logs"} subtitle={locale === "en" ? "Sessions started" : "Số phiên tập bắt đầu"} points={dashboard?.charts.workoutLogs[chartView] ?? []} />
            </div>

            {/* Bottom 2-col: recent users + pending requests */}
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[10px] border border-border bg-card p-[18px]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-foreground">{locale === "en" ? "Recent users" : "Người dùng mới nhất"}</p>
                  <p className="label-micro text-muted-foreground">{locale === "en" ? "Newest accounts" : "Tài khoản mới nhất"}</p>
                </div>
                <div className="flex flex-col">
                  {dashboard?.recentUsers.length ? dashboard.recentUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => { setSelectedUserId(user.id); setActiveSection("users"); void refreshAllData(session.access_token, user.id, true) }}
                      className="flex items-center gap-3 border-t border-border/50 py-2.5 text-left transition-colors first:border-t-0 hover:bg-muted/30"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold uppercase text-muted-foreground">
                        {user.name.split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
                          <Badge variant={roleBadgeVariant(user.role)} className="shrink-0 text-[10px]">{user.role}</Badge>
                          {!user.isActive ? <Badge variant="destructive" className="shrink-0 text-[10px]">{locale === "en" ? "Locked" : "Khoá"}</Badge> : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatDateTime(user.createdAt, locale)}</span>
                    </button>
                  )) : <EmptyState copy={locale === "en" ? "No recent users." : "Chưa có user mới."} />}
                </div>
              </div>

              <div className="rounded-[10px] border border-border bg-card p-[18px]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-foreground">{locale === "en" ? "Pending requests" : "Yêu cầu chờ duyệt"}</p>
                  <Badge variant={pendingRequestCount > 0 ? "default" : "outline"} className="font-mono text-[10px]">
                    {pendingRequestCount} {locale === "en" ? "pending" : "chờ"}
                  </Badge>
                </div>
                <div className="flex flex-col">
                  {dashboard?.pendingCoachRequests.length ? dashboard.pendingCoachRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between border-t border-border/50 py-2.5 first:border-t-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="font-medium text-foreground">{request.trainee.name}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-muted-foreground">{request.coach.name}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{request.trainee.email}</p>
                      </div>
                      <span className="ml-3 shrink-0 font-mono text-[11px] text-muted-foreground">{formatDateTime(request.createdAt, locale)}</span>
                    </div>
                  )) : <EmptyState copy={locale === "en" ? "No pending coach requests." : "Không có yêu cầu chờ duyệt."} />}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            {/* Search + role filter chips */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 basis-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder={locale === "en" ? "Search name, email, phone…" : "Tìm tên, email, số điện thoại…"} className="pl-9" />
              </div>
              <div className="flex gap-1.5">
                {(["all", "trainee", "coach", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setUserRoleFilter(r)}
                    className={`rounded-[5px] px-3 py-1.5 font-mono text-xs transition-colors ${
                      userRoleFilter === r
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Master-detail */}
            <div className="grid items-start gap-4 xl:grid-cols-[360px_1fr]">
              {/* User list — rows with left border indicator */}
              <div className="rounded-[10px] border border-border bg-card overflow-hidden">
                {filteredUsers.length ? filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => void loadUserDetail(user.id)}
                    className={`flex w-full items-center gap-3 border-b border-border/50 px-4 py-[11px] text-left transition-colors last:border-b-0 ${
                      selectedUserId === user.id
                        ? "border-l-[3px] border-l-primary bg-muted/50"
                        : "border-l-[3px] border-l-transparent hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold uppercase text-muted-foreground">
                      {user.name.split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
                        {!user.isActive ? <span className="shrink-0 text-xs text-destructive">🔒</span> : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant={roleBadgeVariant(user.role)} className="shrink-0 text-[10px]">{user.role}</Badge>
                  </button>
                )) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {locale === "en" ? "No users match." : "Không có user nào khớp."}
                  </div>
                )}
              </div>

              {/* User detail panel */}
              <div className="rounded-[10px] border border-border bg-card p-[22px]">
                {userDetail ? (
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-semibold uppercase text-muted-foreground">
                        {userDetail.user.name.split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground">{userDetail.user.name}</h3>
                          <Badge variant={roleBadgeVariant(userDetail.user.role)}>{userDetail.user.role}</Badge>
                          {!userDetail.user.isActive ? <Badge variant="destructive">{locale === "en" ? "Locked" : "Đã khoá"}</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{userDetail.user.email}</p>
                      </div>
                    </div>

                    {/* Role chips */}
                    <div>
                      <p className="label-micro mb-2 text-muted-foreground">{locale === "en" ? "Role" : "Vai trò"}</p>
                      <div className="flex gap-1.5">
                        {(["trainee", "coach", "admin"] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setSelectedRole(r)}
                            className={`rounded-[5px] px-3 py-1.5 font-mono text-xs transition-colors ${
                              selectedRole === r
                                ? "bg-foreground text-background"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Info rows */}
                    <div className="divide-y divide-border/50">
                      {([
                        { k: locale === "en" ? "Username" : "Username", v: userDetail.user.username ?? "—" },
                        { k: locale === "en" ? "Phone" : "Số điện thoại", v: userDetail.user.phone ?? "—", mono: true },
                        { k: locale === "en" ? "Coach" : "Coach", v: userDetail.assignedCoach?.name ?? "—" },
                        { k: locale === "en" ? "Joined" : "Ngày tạo", v: formatDateTime(userDetail.user.createdAt, locale), mono: true },
                        { k: locale === "en" ? "Workouts" : "Workouts", v: String(userDetail.user.stats.workoutLogs), mono: true },
                        ...(userDetail.user.role === "coach" ? [{ k: locale === "en" ? "Clients" : "Clients", v: String(userDetail.user.stats.trainees), mono: true }] : []),
                      ] as Array<{ k: string; v: string; mono?: boolean }>).map((row) => (
                        <div key={row.k} className="flex items-center justify-between py-2.5">
                          <p className="label-micro text-muted-foreground">{row.k}</p>
                          <p className={`text-sm text-foreground ${row.mono ? "font-mono" : ""}`}>{row.v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Password reset */}
                    <div className="rounded-[8px] border border-border bg-muted/20 p-4">
                      <p className="label-micro mb-2 text-muted-foreground">{locale === "en" ? "Manual password reset" : "Reset mật khẩu thủ công"}</p>
                      <div className="flex gap-2">
                        <Input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder={locale === "en" ? "New password" : "Mật khẩu mới"} className="flex-1" />
                        <Button variant="outline" size="sm" onClick={() => void handleResetPassword()} disabled={!resetPassword || actionKey === `password-${userDetail.user.id}`}>
                          {actionKey === `password-${userDetail.user.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                          {locale === "en" ? "Reset" : "Reset"}
                        </Button>
                      </div>
                    </div>

                    {/* Account actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void handleUserUpdate({ role: selectedRole })} disabled={actionKey === `user-${userDetail.user.id}`}>
                        {actionKey === `user-${userDetail.user.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {locale === "en" ? "Save role" : "Lưu vai trò"}
                      </Button>
                      <Button variant={userDetail.user.isActive ? "destructive" : "outline"} onClick={() => void handleUserUpdate({ isActive: !userDetail.user.isActive })} disabled={actionKey === `user-${userDetail.user.id}`}>
                        {userDetail.user.isActive ? (locale === "en" ? "Lock account" : "Khoá tài khoản") : (locale === "en" ? "Unlock account" : "Mở khoá tài khoản")}
                      </Button>
                    </div>

                    {/* Connected trainees (coach view) */}
                    {userDetail.connectedTrainees.length > 0 ? (
                      <div className="rounded-[8px] border border-border bg-muted/20 p-4">
                        <h4 className="mb-3 text-sm font-medium">{locale === "en" ? "Connected trainees" : "Trainee đang kết nối"}</h4>
                        <div className="space-y-2">
                          {userDetail.connectedTrainees.map((trainee) => (
                            <div key={trainee.id} className="flex items-center justify-between border-t border-border/50 py-2 first:border-t-0 text-sm">
                              <span className="font-medium text-foreground">{trainee.name}</span>
                              <span className="text-muted-foreground">{trainee.email}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Recent workout logs */}
                    {userDetail.recentWorkoutLogs.length > 0 ? (
                      <div className="rounded-[8px] border border-border bg-muted/20 p-4">
                        <h4 className="mb-3 text-sm font-medium">{locale === "en" ? "Recent workout logs" : "Workout logs gần đây"}</h4>
                        <div className="space-y-0">
                          {userDetail.recentWorkoutLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between border-t border-border/50 py-2 first:border-t-0 text-sm">
                              <span className="font-medium text-foreground">{log.workout?.name ?? (locale === "en" ? "Workout snapshot" : "Snapshot")}</span>
                              <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(log.startedAt, locale)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState copy={locale === "en" ? "Select a user to view details." : "Chọn một user để xem chi tiết."} />
                )}
              </div>
            </div>
          </TabsContent>


          <TabsContent value="requests" className="space-y-4">
            {/* Search + status filter chips */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 basis-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder={locale === "en" ? "Search requests…" : "Tìm yêu cầu…"} className="pl-9" />
              </div>
              <div className="flex gap-1.5">
                {(["all", "pending", "approved", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRequestStatusFilter(s)}
                    className={`rounded-[5px] px-3 py-1.5 font-mono text-xs transition-colors ${
                      requestStatusFilter === s
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Request list */}
            <div className="flex flex-col gap-2.5">
              {filteredRequests.length ? filteredRequests.map((request) => (
                <div key={request.id} className="rounded-[10px] border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-sm font-semibold text-foreground">{request.trainee.name}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm font-medium text-muted-foreground">{request.coach.name}</span>
                    <Badge variant={requestBadgeVariant(request.status)} className="text-[10px]">{request.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{request.trainee.email} · {formatDateTime(request.createdAt, locale)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
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
                    <Button size="sm" variant="destructive" onClick={() => setConfirmState({ id: request.id, kind: "request", label: `${request.trainee.name} → ${request.coach.name}` })}>
                      <Trash2 className="h-4 w-4" />
                      {locale === "en" ? "Delete" : "Xoá"}
                    </Button>
                  </div>
                </div>
              )) : <EmptyState copy={locale === "en" ? "No requests match the current filters." : "Không có yêu cầu nào khớp bộ lọc."} />}
            </div>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            {/* Assign panel */}
            <div className="rounded-[10px] border border-border bg-card p-[18px]">
              <p className="label-micro mb-3 text-muted-foreground">{locale === "en" ? "Assign coach to trainee" : "Gán coach cho trainee"}</p>
              <div className="flex flex-wrap gap-2">
                <Select value={assignTraineeId} onValueChange={setAssignTraineeId}>
                  <SelectTrigger className="flex-1 basis-[180px]">
                    <SelectValue placeholder={locale === "en" ? "Unassigned trainee" : "Trainee chưa có coach"} />
                  </SelectTrigger>
                  <SelectContent>
                    {connections?.unassignedTrainees.length
                      ? connections.unassignedTrainees.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                      : <SelectItem value="__none__" disabled>{locale === "en" ? "— none —" : "— trống —"}</SelectItem>}
                  </SelectContent>
                </Select>
                <Select value={assignCoachId} onValueChange={setAssignCoachId}>
                  <SelectTrigger className="flex-1 basis-[180px]">
                    <SelectValue placeholder={locale === "en" ? "Choose coach" : "Chọn coach"} />
                  </SelectTrigger>
                  <SelectContent>
                    {connections?.coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone ?? "coach"})</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={() => void handleAssignConnection()} disabled={actionKey === "connection-assign" || !assignCoachId || !assignTraineeId}>
                  {actionKey === "connection-assign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {locale === "en" ? "Assign coach" : "Gán coach"}
                </Button>
              </div>
            </div>

            {/* Search + connection table */}
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={connectionSearch} onChange={(event) => setConnectionSearch(event.target.value)} placeholder={locale === "en" ? "Search connections…" : "Tìm connection…"} className="pl-9" />
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-card overflow-hidden">
              {filteredConnections.length ? filteredConnections.map((connection) => (
                <div key={connection.trainee.id} className="flex items-center gap-3 border-t border-border/50 px-4 py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">{connection.trainee.name}</span>
                      <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{connection.coach.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{connection.trainee.email}</p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmState({ id: connection.trainee.id, kind: "connection", label: `${connection.trainee.name} – ${connection.coach.name}` })}>
                    <Trash2 className="h-4 w-4" />
                    {locale === "en" ? "Unlink" : "Gỡ"}
                  </Button>
                </div>
              )) : (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {locale === "en" ? "No connections found." : "Chưa có connection nào."}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="programs" className="space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={programSearch} onChange={(event) => setProgramSearch(event.target.value)} placeholder={locale === "en" ? "Search programs or coach…" : "Tìm giáo án hoặc coach…"} className="pl-9" />
            </div>

            {/* Program rows */}
            <div className="rounded-[10px] border border-border bg-card overflow-hidden">
              {filteredPrograms.length ? filteredPrograms.map((program) => (
                <div
                  key={program.id}
                  className="grid items-center border-t border-border/50 px-4 py-3 first:border-t-0 gap-2"
                  style={{ gridTemplateColumns: "minmax(0,1fr) 90px 80px 80px auto" }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{program.name}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{program.difficulty}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{locale === "en" ? "by" : "bởi"} {program.createdBy.name}</p>
                  </div>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:block">{program.duration} {locale === "en" ? "wks" : "tuần"}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:block">{program.assignmentCount} {locale === "en" ? "clients" : "người"}</span>
                  <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">{formatDateTime(program.createdAt, locale)}</span>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmState({ id: program.id, kind: "program", label: program.name })}>
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{locale === "en" ? "Delete" : "Xoá"}</span>
                  </Button>
                </div>
              )) : (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {locale === "en" ? "No programs found." : "Chưa có giáo án nào."}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="exercises">
            <AdminExercisesPanel
              exercises={exercises}
              actionKey={actionKey}
              locale={locale}
              onSave={handleSaveExerciseData}
              onDelete={handleDeleteExerciseDirect}
              onImport={() => setIsImportDialogOpen(true)}
              onDownloadTemplate={() => void handleDownloadExerciseTemplate()}
            />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            {/* Search + type filter chips */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 basis-[220px] max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder={locale === "en" ? "Search actions…" : "Tìm hành động…"} className="pl-9" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "user", "request", "exercise", "program", "connection"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAuditEntityType(t)}
                    className={`rounded-[5px] px-3 py-1.5 font-mono text-xs transition-colors ${
                      auditEntityType === t
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit rows */}
            <div className="rounded-[10px] border border-border bg-card overflow-hidden">
              {filteredAuditLogs.length ? filteredAuditLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 border-t border-border/50 px-4 py-3 first:border-t-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] bg-muted">
                    <Activity className="h-[15px] w-[15px] text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{log.action}</span>
                      <Badge variant="outline" className="text-[10px]">{log.entityType}</Badge>
                    </div>
                    <p className="text-sm text-foreground">{log.entityLabel ?? (locale === "en" ? "—" : "—")}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{log.admin.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{formatDateTime(log.createdAt, locale)}</p>
                  </div>
                </div>
              )) : (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {locale === "en" ? "No audit logs match the current filters." : "Không có audit log nào khớp bộ lọc."}
                </div>
              )}
            </div>
          </TabsContent>
              </Tabs>
            )}
          </div>
      </main>

      <Dialog open={isImportDialogOpen} onOpenChange={handleImportDialogChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{locale === "en" ? "Import exercises from Excel" : "Import bài tập từ Excel"}</DialogTitle>
            <DialogDescription>
              {locale === "en"
                ? "Supported files: .xlsx, .xls, .csv. Each row is one variation. Required: exercise_name, muscle_group, variation_name."
                : "Hỗ trợ file .xlsx, .xls, .csv. Mỗi dòng là một variation. Bắt buộc: exercise_name, muscle_group, variation_name."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[10px] border border-dashed border-border bg-muted/20 p-4">
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
                  ? "Accepted aliases include: exercise_name/name, muscle_group/bodyPart, variation_name/variation, equipment, is_default, sort_order."
                  : "Header có thể dùng alias như: exercise_name/name, muscle_group/bodyPart, variation_name/variation, equipment, is_default, sort_order."}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownloadExerciseTemplate()}
                  disabled={actionKey === "exercise-template-download"}
                >
                  {actionKey === "exercise-template-download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {locale === "en" ? "Download Excel template" : "Tải file mẫu Excel"}
                </Button>
              </div>
            </div>

            {importFileName ? (
              <div className="grid gap-3 rounded-[10px] border border-border bg-card p-4 sm:grid-cols-3">
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
              <div className="flex items-center gap-2 rounded-[10px] border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{locale === "en" ? "Reading file..." : "Đang đọc file..."}</span>
              </div>
            ) : null}

            {importIssues.length ? (
              <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 p-4">
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

            {importRows.length ? (
              <div className="rounded-[10px] border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h4 className="text-sm font-semibold">{locale === "en" ? "Preview" : "Xem trước"}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {locale === "en"
                      ? "The first rows below will be created as shared exercise variations."
                      : "Các dòng đầu tiên dưới đây sẽ được tạo thành variation bài tập dùng chung."}
                  </p>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">{locale === "en" ? "Row" : "Dòng"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Exercise" : "Bài tập gốc"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Muscle group" : "Nhóm cơ"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Variation" : "Variation"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Equipment" : "Thiết bị"}</th>
                        <th className="px-4 py-2">{locale === "en" ? "Default" : "Mặc định"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 8).map((row) => (
                        <tr key={`${row.rowNumber}-${row.exerciseName}-${row.variationName}`} className="border-t border-border">
                          <td className="px-4 py-2 text-muted-foreground">{row.rowNumber}</td>
                          <td className="px-4 py-2 font-medium">{row.exerciseName}</td>
                          <td className="px-4 py-2">{row.muscleGroup}</td>
                          <td className="px-4 py-2">{row.variationName}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.equipment ?? (locale === "en" ? "No equipment" : "Không có thiết bị")}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.isDefault ? "TRUE" : "FALSE"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 8 ? (
                  <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    {locale === "en"
                      ? `Showing 8 of ${importRows.length} valid rows.`
                      : `Đang hiển thị 8/${importRows.length} dòng hợp lệ.`}
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
            <DialogTitle>{confirmDialogTitle}</DialogTitle>
            <DialogDescription>
              {confirmDialogDescription}
              <span className="mt-2 block font-medium text-foreground">{confirmState?.label}</span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmState(null)}>
              {locale === "en" ? "Cancel" : "Huỷ"}
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmAction()} disabled={Boolean(actionKey?.startsWith("confirm-"))}>
              {actionKey?.startsWith("confirm-") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {confirmDialogActionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

