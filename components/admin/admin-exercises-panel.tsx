"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  ArrowDownUp,
  ChevronDown,
  Check,
  Download,
  Dumbbell,
  FileSpreadsheet,
  ImageUp,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import { ExerciseGroupGrid, ExerciseRowGrid, type ExerciseRowActionHandlers } from "@/components/admin/exercise-library-browser"
import { ExerciseMediaEditor } from "@/components/admin/exercise-media-editor"
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { Badge } from "@/components/ui/badge"
import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import { TRAINABLE_MUSCLE_SLUGS, type MuscleSlug as MapMuscleSlug } from "@/components/body/muscle-map"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InputWithIcon } from "@/components/ui/input-with-icon"
import { Label } from "@/components/ui/label"
import {
  compileExerciseSearch,
  createExerciseSearchDocument,
  filterExerciseSearch,
  matchesExerciseSearchDocument,
  sortByExerciseRelevance,
} from "@/lib/exercise-search"
import { buildMuscleProfileHighlights, muscleGroupFromSlug, muscleGroupToSlugs } from "@/lib/fitness/muscle-map"
import { cn } from "@/lib/utils"
import type { AdminExerciseImportRequest, AdminExerciseItem, AdminExerciseMediaFiles } from "@/lib/admin/types"
import { EXERCISE_MEDIA_FILE_RULES, exerciseMediaFileProblem, exerciseMediaMaxMegabytes } from "@/lib/admin/exercise-media-files"
import type { ExerciseActivityType, MovementPattern, MuscleSlug } from "@/lib/types"
import { MOVEMENT_PATTERNS, movementPatternLabel } from "@/lib/fitness/movement-pattern"
import { getLibraryGroup, LIBRARY_GROUPS, libraryGroupOf, sortEquipmentChips, type LibraryGroupKey } from "@/lib/fitness/exercise-library-groups"
import { findDuplicateExercise } from "@/lib/fitness/exercise-name"
import type { ExerciseAIDraft } from "@/lib/fitness/api"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const MUSCLES = [
  "Chest", "Back", "Legs", "Shoulders", "Arms",
  "Core", "Glutes", "Calves", "Cardio", "Other",
]
const EQUIP = [
  "Barbell", "Dumbbell", "Kettlebell", "Cable", "Machine",
  "Bodyweight", "Resistance Band", "EZ Bar", "Smith Machine",
  "Pull-up Bar", "Bench", "Medicine Ball", "TRX", "Other",
]
const ACTIVITY_TYPES: ExerciseActivityType[] = ["strength", "cardio", "mobility", "sport", "other"]
const EXERCISE_FORM_LABEL_CLASS = "text-[10px] font-semibold uppercase tracking-[0.045em] text-muted-foreground"
const NATIVE_SELECT_CLASS =
  "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark] [&_option]:bg-background [&_option]:text-foreground"
const MUSCLE_FILTERS: MuscleSlug[] = [
  "abs",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "deltoids",
  "forearm",
  "gluteal",
  "hamstring",
  "lower-back",
  "obliques",
  "quadriceps",
  "tibialis",
  "trapezius",
  "triceps",
  "upper-back",
]

type FormData = {
  activityType: ExerciseActivityType
  id?: string
  mediaFiles?: AdminExerciseMediaFiles
  movementPattern: MovementPattern | null
  name: string
  variationName: string
  muscleGroup: string
  primaryMuscles: MuscleSlug[]
  secondaryMuscles: MuscleSlug[]
  equipment: string
  /** Set only by a form that offers sharing: also send it for admin review. */
  shareRequested?: boolean
}

function getExercisePanelCopy(locale: "en" | "vi") {
  return {
    aiConfidence: {
      high: locale === "en" ? "High confidence" : "Độ tin cậy cao",
      low: locale === "en" ? "Low confidence" : "Độ tin cậy thấp",
      medium: locale === "en" ? "Medium confidence" : "Độ tin cậy vừa",
    },
    aiDraftButton: locale === "en" ? "Fill with AI" : "Điền bằng AI",
    aiDraftError: locale === "en" ? "Could not draft the exercise. Please try again." : "Không thể tạo bài tập bằng AI. Vui lòng thử lại.",
    aiDraftHint:
      locale === "en"
        ? "Type the exercise name and AI fills in the rest when you leave the field."
        : "Nhập tên bài tập, AI sẽ tự điền các trường còn lại khi bạn rời ô này.",
    aiDraftLoading: locale === "en" ? "AI is looking up this exercise…" : "AI đang tra cứu bài tập…",
    aiDraftUseName: (name: string) => (locale === "en" ? `Use the standard name "${name}"` : `Dùng tên chuẩn "${name}"`),
    aiDraftNotFound: locale === "en" ? "AI could not recognise this exercise. Try a more specific description." : "AI chưa nhận ra bài tập này. Hãy mô tả cụ thể hơn.",
    aiDraftReview: locale === "en" ? "Check the muscles and equipment before saving." : "Kiểm tra lại cơ và thiết bị trước khi lưu.",
    offerShare: locale === "en" ? "Suggest for the shared library" : "Đề xuất dùng chung cho mọi người",
    offerShareHint:
      locale === "en"
        ? "You can use it right away. An admin reviews it before other coaches and trainees see it."
        : "Bạn dùng được ngay. Admin duyệt xong thì coach và trainee khác mới thấy.",
    requestShare: locale === "en" ? "Suggest for shared library" : "Đề xuất dùng chung",
    shareStatus: {
      pending: locale === "en" ? "Awaiting review" : "Chờ duyệt",
      rejected: locale === "en" ? "Not shared" : "Chưa được duyệt",
      shared: locale === "en" ? "Shared" : "Dùng chung",
    },
    addToLibrary: locale === "en" ? "Add to library" : "Thêm vào thư viện",
    allEquipment: locale === "en" ? "All" : "Tất cả",
    duplicateHint:
      locale === "en"
        ? "Using it keeps training history and progress in one place."
        : "Dùng bài có sẵn để lịch sử tập và tiến độ không bị tách đôi.",
    duplicateShareHint:
      locale === "en"
        ? "Using it keeps history in one place. A copy would stay private: it will not be suggested for the shared library."
        : "Dùng bài có sẵn để giữ chung lịch sử tập. Nếu vẫn tạo, bản này chỉ là bài riêng và sẽ không được đề xuất dùng chung.",
    duplicateTitle: (name: string) => (locale === "en" ? `The library already has "${name}"` : `Thư viện đã có "${name}"`),
    useExisting: locale === "en" ? "Use this one" : "Dùng bài này",
    breadcrumb: locale === "en" ? "Breadcrumb" : "Đường dẫn",
    fuzzyResults: (query: string, count: number) =>
      locale === "en"
        ? `No exact match for "${query}" — showing ${count.toLocaleString()} close match${count === 1 ? "" : "es"}`
        : `Không có bài khớp đúng "${query}" — đang hiện ${count.toLocaleString()} bài gần giống`,
    exerciseCount: (count: number) => (locale === "en" ? `${count.toLocaleString()} exercise${count === 1 ? "" : "s"}` : `${count.toLocaleString()} bài tập`),
    libraryDescription:
      locale === "en"
        ? "Browse exercise categories by muscle group to find technique guides, target muscles, and movement variations."
        : "Duyệt bài tập theo nhóm cơ để xem hướng dẫn kỹ thuật, cơ mục tiêu và các biến thể.",
    libraryTitle: locale === "en" ? "Exercise Library" : "Thư viện bài tập",
    searchResults: (count: number) => (locale === "en" ? `${count.toLocaleString()} results across all groups` : `${count.toLocaleString()} kết quả trong mọi nhóm`),
    approve: locale === "en" ? "Approve" : "Duyệt",
    approveProfile: locale === "en" ? "Approve muscle profile" : "Duyệt profile cơ",
    approveProfiles: locale === "en" ? "Approve muscle profiles" : "Duyệt profile cơ",
    cannotApproveProfile: locale === "en" ? "Add a primary muscle before approving" : "Cần có cơ chính trước khi duyệt",
    profileFilterAll: locale === "en" ? "Muscles: all" : "Cơ: tất cả",
    profileFilterPending: locale === "en" ? "Needs review" : "Chờ duyệt",
    profileFilterApproved: locale === "en" ? "Approved" : "Đã duyệt",
    cancel: locale === "en" ? "Cancel" : "Hủy",
    cannotDeleteInUse: locale === "en" ? "Cannot delete - in use" : "Không thể xóa - đang được dùng",
    cannotManageShared: locale === "en" ? "Cannot manage shared exercise" : "Không thể sửa bài tập dùng chung",
    coachExerciseImports: locale === "en" ? "Coach exercise imports" : "Import bài tập từ coach",
    create: locale === "en" ? "Create" : "Tạo",
    default: locale === "en" ? "Default" : "Mặc định",
    delete: locale === "en" ? "Delete" : "Xóa",
    deleteConfirm: (name: string, variation: string) =>
      locale === "en" ? `Delete "${name} · ${variation}"?` : `Xóa "${name} · ${variation}"?`,
    deleteDescription:
      locale === "en"
        ? "This exercise variation will be removed from the library."
        : "Biến thể bài tập này sẽ bị xóa khỏi thư viện.",
    deleteSelected: (count: number) =>
      locale === "en" ? `Delete ${count} selected` : `Xóa ${count} đã chọn`,
    deleteSelectedConfirm: (count: number) =>
      locale === "en"
        ? `Delete ${count} selected exercise(s)?`
        : `Xóa ${count} bài tập đã chọn?`,
    deleteSelectedDescription:
      locale === "en"
        ? "Exercises that are already in use will be skipped."
        : "Bài tập đang được dùng sẽ được bỏ qua.",
    deselectAll: locale === "en" ? "Deselect all" : "Bỏ chọn tất cả",
    doneSelecting: locale === "en" ? "Done" : "Xong",
    selectMany: locale === "en" ? "Select" : "Chọn nhiều",
    downloadTemplate: locale === "en" ? "Download template" : "Tải file mẫu",
    exportAll: locale === "en" ? "Export Excel" : "Export Excel",
    transferMetadata: locale === "en" ? "Transfer metadata" : "Chuyển metadata",
    transferTitle: locale === "en" ? "Transfer exercise metadata" : "Chuyển metadata bài tập",
    transferDescription: locale === "en" ? "Choose a source variation. Its metadata will overwrite the target." : "Chọn variation nguồn. Metadata nguồn sẽ ghi đè metadata đích.",
    transferWarning: locale === "en"
      ? "This overwrites the target's media, instructions and source data (body part, target muscle). Its approved primary and secondary muscles stay as they are. You can undo it right after."
      : "Thao tác này ghi đè media, hướng dẫn tập và dữ liệu gốc (vùng cơ, cơ mục tiêu) của bài đích. Cơ chính và cơ phụ đã duyệt giữ nguyên. Có thể hoàn tác ngay sau khi chuyển.",
    undoTransfer: locale === "en" ? "Undo metadata transfer" : "Hoàn tác chuyển metadata",
    source: locale === "en" ? "Source" : "Nguồn",
    target: locale === "en" ? "Target" : "Đích",
    transfer: locale === "en" ? "Transfer" : "Chuyển",
    editExercise: locale === "en" ? "Edit exercise" : "Sửa bài tập",
    edit: locale === "en" ? "Edit" : "Sửa",
    equipment: locale === "en" ? "Equipment" : "Thiết bị",
    equipmentFilterAll: locale === "en" ? "Equipment: all" : "Dụng cụ: tất cả",
    exercise: locale === "en" ? "Exercise" : "Bài tập",
    exerciseName: locale === "en" ? "Exercise name" : "Tên bài tập",
    importExcel: locale === "en" ? "Import Excel" : "Nhập Excel",
    movementPattern: locale === "en" ? "Movement pattern" : "Kiểu chuyển động",
    movementPatternUnset: locale === "en" ? "Not set" : "Chưa phân loại",
    newExercise: locale === "en" ? "New exercise" : "Bài tập mới",
    noMatches: locale === "en" ? "No exercises match." : "Không có bài tập nào khớp.",
    pending: locale === "en" ? "pending" : "chờ duyệt",
    pendingReview: locale === "en" ? "Pending review" : "Chờ duyệt",
    reject: locale === "en" ? "Reject" : "Từ chối",
    rows: locale === "en" ? "rows" : "dòng",
    save: locale === "en" ? "Save" : "Lưu",
    searchExercises: locale === "en" ? "Search exercises..." : "Tìm bài tập...",
    selected: (count: number) =>
      locale === "en" ? `${count} selected` : `${count} đã chọn`,
    selectAll: locale === "en" ? "Select all" : "Chọn tất cả",
    selectGroup: locale === "en" ? "Select group" : "Chọn nhóm",
    submittedBy: locale === "en" ? "Submitted by" : "Gửi bởi",
    untitledImport: locale === "en" ? "Untitled import" : "File import chưa đặt tên",
    usageCount: (count: number) =>
      locale === "en" ? `${count.toLocaleString()} uses` : `${count.toLocaleString()} lượt dùng`,
    uses: locale === "en" ? "Uses" : "Lượt dùng",
    variation: locale === "en" ? "Variation" : "Variation",
    variationCount: (count: number) => (locale === "en" ? `${count} variation${count === 1 ? "" : "s"}` : `${count} variation`),
  }
}

function formatMuscleSlug(slug: MuscleSlug) {
  return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

function hasDraftMedia(files: AdminExerciseMediaFiles) {
  return Boolean(files.thumbnail || files.animation)
}

function hasCompleteDraftMedia(files: AdminExerciseMediaFiles) {
  return Boolean(files.thumbnail && files.animation)
}

function CreateExerciseMediaDraft({
  files,
  locale,
  onChange,
}: {
  files: AdminExerciseMediaFiles
  locale: "en" | "vi"
  onChange: (files: AdminExerciseMediaFiles) => void
}) {
  const [message, setMessage] = useState<string | null>(null)

  function pickFile(kind: keyof AdminExerciseMediaFiles, file: File | undefined) {
    if (!file) return
    const problem = exerciseMediaFileProblem(kind, file)
    if (problem) {
      setMessage(
        problem === "type"
          ? `${kind === "thumbnail" ? "Thumbnail" : "Animation"} chỉ nhận ${EXERCISE_MEDIA_FILE_RULES[kind].extensions}.`
          : `${kind === "thumbnail" ? "Thumbnail" : "Animation"} tối đa ${exerciseMediaMaxMegabytes(kind)}MB.`,
      )
      return
    }
    setMessage(null)
    onChange({ ...files, [kind]: file })
  }

  function clearFile(kind: keyof AdminExerciseMediaFiles) {
    const next = { ...files }
    delete next[kind]
    onChange(next)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col items-center justify-center gap-3 py-2">
        <div className="flex size-24 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ImageUp className="size-8" />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {(["thumbnail", "animation"] as const).map((kind) => (
            <label key={kind} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80">
              <ImageUp className="size-4" />
              {kind === "thumbnail"
                ? (files.thumbnail ? (locale === "en" ? "Thumbnail added" : "Đã chọn ảnh") : (locale === "en" ? "Add image" : "Thêm ảnh"))
                : (files.animation ? (locale === "en" ? "Animation added" : "Đã chọn animation") : (locale === "en" ? "Add animation" : "Thêm animation"))}
              <input
                type="file"
                accept={EXERCISE_MEDIA_FILE_RULES[kind].contentTypes.join(",")}
                className="sr-only"
                onChange={(event) => pickFile(kind, event.target.files?.[0])}
              />
            </label>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {locale === "en"
            ? "Media is optional. Add both image and animation to upload now."
            : "Media không bắt buộc. Chọn cả ảnh và animation nếu muốn tải lên ngay."}
        </p>
      </div>

      {hasDraftMedia(files) ? (
        <div className="grid gap-2 sm:grid-cols-2">
        {(["thumbnail", "animation"] as const).map((kind) => {
          const file = files[kind]
          return file ? (
            <div key={kind} className="rounded-md border border-dashed border-input bg-surface-subtle p-2.5">
              <p className="text-xs font-medium text-foreground">{kind === "thumbnail" ? "Thumbnail" : "Animation"}</p>
              <p className="text-micro text-muted-foreground">
                {EXERCISE_MEDIA_FILE_RULES[kind].extensions} · {locale === "en" ? "max" : "tối đa"} {exerciseMediaMaxMegabytes(kind)}MB
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{file.name}</span>
                <button
                  type="button"
                  aria-label={locale === "en" ? `Remove ${kind} file` : `Bỏ file ${kind}`}
                  onClick={() => clearFile(kind)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ) : null
        })}
        </div>
      ) : null}
      {message ? <p role="alert" className="mt-2 text-xs text-destructive-text">{message}</p> : null}
      {!message && hasDraftMedia(files) && !hasCompleteDraftMedia(files) ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {locale === "en"
            ? "Either add the other media file or remove the selected file to create without media."
            : "Thêm file media còn lại, hoặc bỏ file đã chọn để tạo bài không có media."}
        </p>
      ) : null}
    </section>
  )
}

function MuscleComboboxMultiSelect({
  label,
  onChange,
  options,
  placeholder,
  selected,
}: {
  label: string
  onChange: (muscles: MuscleSlug[]) => void
  options: MuscleSlug[]
  placeholder: string
  selected: MuscleSlug[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const selectedSet = new Set(selected)
  const filteredOptions = options.filter((muscle) => {
    if (selectedSet.has(muscle)) return false
    if (!normalizedQuery) return true
    return muscle.includes(normalizedQuery) || formatMuscleSlug(muscle).toLowerCase().includes(normalizedQuery)
  })

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  function addMuscle(muscle: MuscleSlug) {
    onChange([...selected, muscle])
    setQuery("")
    setOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function removeMuscle(muscle: MuscleSlug) {
    onChange(selected.filter((entry) => entry !== muscle))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !query && selected.length) {
      event.preventDefault()
      removeMuscle(selected[selected.length - 1])
      return
    }

    if (event.key === "Enter" && filteredOptions[0]) {
      event.preventDefault()
      addMuscle(filteredOptions[0])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Label className={EXERCISE_FORM_LABEL_CLASS}>{label}</Label>
      <div
        role="button"
        tabIndex={-1}
        className={cn(
          "mt-1.5 flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-surface px-2.5 py-1.5 text-sm shadow-xs transition-colors hover:border-ring/50",
          open && "border-primary bg-surface ring-2 ring-primary/10",
        )}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {selected.map((muscle) => (
          <span
            key={muscle}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-micro font-semibold uppercase text-primary"
          >
            <span className="truncate">{formatMuscleSlug(muscle)}</span>
            <button
              type="button"
              aria-label={`Remove ${formatMuscleSlug(muscle)}`}
              className="rounded-full p-0.5 text-primary/70 hover:bg-primary/15 hover:text-primary"
              onClick={(event) => {
                event.stopPropagation()
                removeMuscle(muscle)
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          placeholder={selected.length ? "" : placeholder}
          className="h-6 min-w-[120px] flex-1 appearance-none border-0 bg-transparent p-0 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {open ? (
        <div className="absolute z-[130] mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg">
          {filteredOptions.length ? (
            filteredOptions.map((muscle) => (
              <button
                key={muscle}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left font-medium hover:bg-muted"
                onClick={() => addMuscle(muscle)}
              >
                <span>{formatMuscleSlug(muscle)}</span>
                <span className="text-micro uppercase text-muted-foreground">{muscle}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">No muscles found</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function ExerciseComboboxSingleSelect({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  placeholder: string
  value: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selectedOption = options.find((option) => option.value === value)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = options.filter((option) => {
    if (!normalizedQuery) return true
    return option.value.toLowerCase().includes(normalizedQuery) || option.label.toLowerCase().includes(normalizedQuery)
  })

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  function selectOption(nextValue: string) {
    onChange(nextValue)
    setQuery("")
    setOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && filteredOptions[0]) {
      event.preventDefault()
      selectOption(filteredOptions[0].value)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Label className={EXERCISE_FORM_LABEL_CLASS}>{label}</Label>
      <div
        role="button"
        tabIndex={-1}
        className={cn(
          "mt-1.5 flex min-h-10 w-full cursor-text items-center gap-1.5 rounded-md border border-input bg-surface px-2.5 py-1.5 text-sm shadow-xs transition-colors hover:border-ring/50",
          open && "border-primary bg-surface ring-2 ring-primary/10",
        )}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {selectedOption && !query ? (
          <span className="inline-flex min-w-0 items-center rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary">
            <span className="truncate">{selectedOption.label}</span>
          </span>
        ) : null}
        <input
          ref={inputRef}
          value={query}
          placeholder={selectedOption && !query ? "" : placeholder}
          className="h-6 min-w-[120px] flex-1 appearance-none border-0 bg-transparent p-0 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {open ? (
        <div className="absolute z-[130] mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left font-medium hover:bg-muted"
                onClick={() => selectOption(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check className="size-4 text-primary" /> : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">No options found</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ExerciseFormModal                                                    */
/* ------------------------------------------------------------------ */

export type ExerciseFormModalProps = {
  /** Offer media files when creating; only admins can upload them. */
  allowMedia?: boolean
  initial: AdminExerciseItem | null
  /** Prefills the name of a new exercise, e.g. with what a picker search found nothing for. */
  initialName?: string
  locale: "en" | "vi"
  /** Media upload for the exercise being edited; it saves independently of the form. */
  mediaEditor?: ReactNode
  /** A coach's new exercise: offer to send it for review, ticked by default. */
  offerShare?: boolean
  /** Library exercises a new name is checked against, live and without AI. */
  duplicateCandidates?: ReadonlyArray<{ id: string; name: string }>
  /** Offered on a duplicate warning: use the existing exercise instead of creating a copy. */
  onUseExisting?: (id: string) => void
  /** Offers an AI pre-fill when creating; the draft is only saved when the form is. */
  onAiDraft?: (input: { locale: "en" | "vi"; query: string }) => Promise<ExerciseAIDraft>
  saving: boolean
  /** Opened on top of another dialog (an exercise picker), so it layers above it. */
  stacked?: boolean
  onClose: () => void
  onSave: (data: FormData) => void
}

export function ExerciseFormModal({
  allowMedia = true,
  initial,
  initialName,
  locale,
  mediaEditor,
  offerShare = false,
  duplicateCandidates,
  onUseExisting,
  onAiDraft,
  saving,
  stacked = false,
  onClose,
  onSave,
}: ExerciseFormModalProps) {
  const copy = getExercisePanelCopy(locale)
  const [name, setName] = useState(initial?.name ?? initialName ?? "")
  const [shareRequested, setShareRequested] = useState(true)
  const [variationName, setVariation] = useState(initial?.variationName === "Default" ? "" : (initial?.variationName ?? ""))
  const [muscleGroup, setMuscle] = useState(initial?.muscleGroup ?? MUSCLES[0])
  const [equipment, setEquipment] = useState(initial?.equipment ?? EQUIP[0])
  const [activityType, setActivityType] = useState<ExerciseActivityType>(initial?.activityType ?? "strength")
  const [movementPattern, setMovementPattern] = useState<MovementPattern | "">(initial?.movementPattern ?? "")
  const [primaryMuscles, setPrimaryMuscles] = useState<MuscleSlug[]>(initial?.primaryMuscles ?? [])
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleSlug[]>(initial?.secondaryMuscles ?? [])
  const [mediaFiles, setMediaFiles] = useState<AdminExerciseMediaFiles>({})
  const [targetRole, setTargetRole] = useState<"primary" | "secondary">("primary")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiEstimate, setAiEstimate] = useState<Extract<ExerciseAIDraft, { found: true }> | null>(null)
  // Once the coach edits a field by hand, leaving the name box no longer overwrites it; the AI button still does.
  const [fieldsTouched, setFieldsTouched] = useState(false)
  // The name the last lookup ran for, so tabbing in and out does not spend another lookup.
  const lastLookupName = useRef("")
  // Guards against the blur and the button firing one lookup each for the same click.
  const aiInFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    // Set here, not only in the initialiser: StrictMode runs cleanup then this again.
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const showAiDraft = Boolean(onAiDraft) && !initial
  // Typed-name match first (free, live); the AI's canonical-name match catches what spelling alone misses.
  const typedDuplicate = useMemo(
    () => (!initial && duplicateCandidates && name.trim().length >= 3 ? findDuplicateExercise(name, duplicateCandidates) : undefined),
    [duplicateCandidates, initial, name],
  )
  const duplicate = typedDuplicate ?? aiEstimate?.existingExercise ?? null

  /** Wraps a field's setter so a manual edit stops automatic AI fills. */
  function manual<T>(setter: (value: T) => void) {
    return (value: T) => {
      setFieldsTouched(true)
      setter(value)
    }
  }

  const hasIncompleteMedia = hasDraftMedia(mediaFiles) && !hasCompleteDraftMedia(mediaFiles)
  const canSave = name.trim().length > 0 && (activityType !== "strength" || primaryMuscles.length > 0) && !hasIncompleteMedia
  const muscleHighlights = buildMuscleProfileHighlights(
    [{ activityType, muscleProfileStatus: "approved", primaryMuscles, secondaryMuscles }],
    "var(--primary)",
    "color-mix(in oklab, var(--primary) 45%, var(--body-fill))",
  )

  function toggleMuscle(slug: MapMuscleSlug) {
    if (!(TRAINABLE_MUSCLE_SLUGS as readonly string[]).includes(slug)) return
    const target = slug as MuscleSlug

    if (targetRole === "primary") {
      setSecondaryMuscles((current) => current.filter((entry) => entry !== target))
      setPrimaryMuscles((current) =>
        current.includes(target) ? current.filter((entry) => entry !== target) : [...current, target],
      )
      return
    }

    setPrimaryMuscles((current) => current.filter((entry) => entry !== target))
    setSecondaryMuscles((current) =>
      current.includes(target) ? current.filter((entry) => entry !== target) : [...current, target],
    )
  }

  function handlePrimaryMusclesChange(nextMuscles: MuscleSlug[]) {
    setPrimaryMuscles(nextMuscles)
    setSecondaryMuscles((current) => current.filter((entry) => !nextMuscles.includes(entry)))
    const nextGroup = muscleGroupFromSlug(nextMuscles[0])
    if (nextGroup) setMuscle(nextGroup)
  }

  function handleSecondaryMusclesChange(nextMuscles: MuscleSlug[]) {
    setSecondaryMuscles(nextMuscles.filter((entry) => !primaryMuscles.includes(entry)))
  }

  /**
   * Looks the typed name up and fills every other field. `auto` is a lookup the
   * form starts by itself (leaving the name box, opening with a name); it is
   * skipped when nothing changed or the coach already filled fields by hand.
   */
  async function handleAiDraft({ auto }: { auto: boolean }) {
    const query = name.trim()
    if (!onAiDraft || !showAiDraft || query.length < 3 || aiInFlight.current) return
    if (auto && (fieldsTouched || query.toLowerCase() === lastLookupName.current.toLowerCase())) return
    lastLookupName.current = query
    aiInFlight.current = true
    setAiLoading(true)
    setAiMessage(null)
    try {
      const draft = await onAiDraft({ locale, query })
      if (!draft.found) {
        setAiEstimate(null)
        setAiMessage(draft.note || copy.aiDraftNotFound)
        return
      }
      // The coach's own wording stays; a different canonical name is offered instead (see the hint below the field).
      setVariation(draft.variationName)
      setActivityType(draft.activityType)
      setMovementPattern(draft.movementPattern)
      setEquipment(EQUIP.includes(draft.equipment) ? draft.equipment : "Other")
      setMuscle(MUSCLES.includes(draft.muscleGroup) ? draft.muscleGroup : (muscleGroupFromSlug(draft.primaryMuscles[0]) ?? "Other"))
      setPrimaryMuscles(draft.primaryMuscles)
      setSecondaryMuscles(draft.secondaryMuscles.filter((slug) => !draft.primaryMuscles.includes(slug)))
      setAiEstimate(draft)
      setFieldsTouched(false)
    } catch (draftError) {
      setAiEstimate(null)
      setAiMessage(draftError instanceof Error ? draftError.message : copy.aiDraftError)
    } finally {
      aiInFlight.current = false
      setAiLoading(false)
    }
  }

  // Opened with a name (a picker search that found nothing): look it up straight away.
  const openedWithName = useRef(false)
  useEffect(() => {
    if (openedWithName.current || !showAiDraft || (initialName?.trim().length ?? 0) < 3) return
    openedWithName.current = true
    void handleAiDraft({ auto: true })
    // Runs once on open; later name changes go through blur, Enter or the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSave() {
    if (!canSave) return
    onSave({
      activityType,
      equipment,
      id: initial?.id,
      mediaFiles: !initial && hasCompleteDraftMedia(mediaFiles) ? mediaFiles : undefined,
      movementPattern: movementPattern || null,
      muscleGroup,
      name: name.trim(),
      primaryMuscles,
      secondaryMuscles,
      shareRequested: offerShare && !initial ? shareRequested : undefined,
      variationName: variationName.trim() || "Default",
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        overlayClassName={stacked ? "z-[105]" : undefined}
        className={cn("flex max-h-[90vh] max-w-[560px] flex-col gap-0 overflow-hidden rounded-xl p-0", stacked && "z-[110]")}
      >
        <VisuallyHidden>
          <DialogTitle>{initial ? copy.editExercise : copy.newExercise}</DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="border-b border-border px-6 pb-4 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {initial ? copy.editExercise : (locale === "en" ? "Add New Exercise" : "Thêm bài tập mới")}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {initial ? mediaEditor : allowMedia ? (
            <CreateExerciseMediaDraft files={mediaFiles} locale={locale} onChange={setMediaFiles} />
          ) : null}

          {/* Name — on a new exercise, also what the AI looks up */}
          <div>
            <Label htmlFor="exercise-form-name" className={EXERCISE_FORM_LABEL_CLASS}>{copy.exerciseName}</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="exercise-form-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                // A beat later, so leaving via Cancel or the close button (which unmounts the form) costs no lookup.
                onBlur={() => window.setTimeout(() => { if (mounted.current) void handleAiDraft({ auto: true }) }, 150)}
                onKeyDown={(e) => {
                  if (showAiDraft && e.key === "Enter") {
                    e.preventDefault()
                    void handleAiDraft({ auto: false })
                  }
                }}
                placeholder="e.g. Bench Press"
                aria-describedby={showAiDraft ? "exercise-form-ai-status" : undefined}
                autoFocus
              />
              {showAiDraft ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void handleAiDraft({ auto: false })}
                  disabled={aiLoading || name.trim().length < 3}
                  aria-label={copy.aiDraftButton}
                  title={copy.aiDraftButton}
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                  <span className="hidden sm:inline">{copy.aiDraftButton}</span>
                </Button>
              ) : null}
            </div>
            {showAiDraft ? (
              <div id="exercise-form-ai-status" className="mt-2 space-y-1" role="status" aria-live="polite">
                {aiLoading ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    {copy.aiDraftLoading}
                  </p>
                ) : aiEstimate ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={aiEstimate.confidence === "low" ? "destructive" : "secondary"} className="text-micro">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        {copy.aiConfidence[aiEstimate.confidence]}
                      </Badge>
                      {aiEstimate.name.toLowerCase() !== name.trim().toLowerCase() ? (
                        <button
                          type="button"
                          onClick={() => {
                            setName(aiEstimate.name)
                            lastLookupName.current = aiEstimate.name
                          }}
                          className="text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {copy.aiDraftUseName(aiEstimate.name)}
                        </button>
                      ) : null}
                    </div>
                    {aiEstimate.note ? <p className="text-xs text-muted-foreground">{aiEstimate.note}</p> : null}
                    <p className="text-xs text-muted-foreground">{copy.aiDraftReview}</p>
                  </>
                ) : aiMessage ? (
                  <p className="text-xs text-destructive-text" role="alert">{aiMessage}</p>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
                    {copy.aiDraftHint}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {duplicate ? (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 text-xs leading-5 text-warning-text">
                <p className="font-semibold">{copy.duplicateTitle(duplicate.name)}</p>
                <p>{offerShare ? copy.duplicateShareHint : copy.duplicateHint}</p>
              </div>
              {onUseExisting ? (
                <Button type="button" size="sm" variant="outline" className="shrink-0 bg-background" onClick={() => onUseExisting(duplicate.id)}>
                  {copy.useExisting}
                </Button>
              ) : null}
            </div>
          ) : null}

          {/* Variation */}
          <div>
            <Label className={EXERCISE_FORM_LABEL_CLASS}>{copy.variation}</Label>
            <Input
              className="mt-1.5"
              value={variationName}
              onChange={(e) => manual(setVariation)(e.target.value)}
              placeholder={locale === "en" ? "e.g. Wide Grip" : "VD: Wide Grip"}
            />
          </div>

          <ExerciseComboboxSingleSelect
            label={locale === "en" ? "Exercise Type" : "Loại bài tập"}
            options={ACTIVITY_TYPES.map((type) => ({ label: type, value: type }))}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            value={activityType}
            onChange={(value) => manual(setActivityType)(value as ExerciseActivityType)}
          />

          <ExerciseComboboxSingleSelect
            label={copy.movementPattern}
            options={[
              { label: copy.movementPatternUnset, value: "" },
              ...MOVEMENT_PATTERNS.map((pattern) => ({ label: movementPatternLabel(pattern, locale), value: pattern })),
            ]}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            value={movementPattern}
            onChange={(value) => manual(setMovementPattern)(value as MovementPattern | "")}
          />

          <ExerciseComboboxSingleSelect
            label={copy.equipment}
            options={EQUIP.map((eq) => ({ label: eq, value: eq }))}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            value={equipment}
            onChange={manual(setEquipment)}
          />

          <MuscleComboboxMultiSelect
            label={locale === "en" ? "Primary Muscle Group" : "Cơ chính"}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            options={MUSCLE_FILTERS}
            selected={primaryMuscles}
            onChange={manual(handlePrimaryMusclesChange)}
          />

          <MuscleComboboxMultiSelect
            label={locale === "en" ? "Other Muscles" : "Cơ phụ"}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            options={MUSCLE_FILTERS.filter((muscle) => !primaryMuscles.includes(muscle))}
            selected={secondaryMuscles}
            onChange={manual(handleSecondaryMusclesChange)}
          />

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className={EXERCISE_FORM_LABEL_CLASS}>Muscle targets</Label>
              <div className="flex gap-1">
                {(["primary", "secondary"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setTargetRole(role)}
                    className={cn(
                      "rounded-full border px-2 py-1 text-micro uppercase",
                      targetRole === role ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <MuscleMapPair
              className="mt-3"
              highlights={muscleHighlights}
              label={locale === "en" ? "Exercise muscle targets" : "Vùng cơ của bài tập"}
              onMuscleClick={manual(toggleMuscle)}
            />
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Primary:</span> {primaryMuscles.join(", ") || "—"}</p>
              <p><span className="font-medium text-foreground">Secondary:</span> {secondaryMuscles.join(", ") || "—"}</p>
              {initial?.muscleProfileRationale ? <p>{initial.muscleProfileRationale}</p> : null}
            </div>
          </div>

          {offerShare && !initial ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={shareRequested}
                onCheckedChange={(checked) => setShareRequested(checked === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{copy.offerShare}</span>
                <span className="block text-xs text-muted-foreground">{copy.offerShareHint}</span>
              </span>
            </label>
          ) : null}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {initial ? copy.save : copy.create}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** How many matches the source picker renders; the query narrows the rest. */
const TRANSFER_PICKER_LIMIT = 50

/**
 * A search box over library variations, instead of a native select with
 * hundreds of options. Each match shows its thumbnail, so two exercises
 * with the same name (e.g. two "machine shoulder press") can be told apart.
 */
export function VariationSearchPicker({
  candidates,
  emptyLabel,
  inputId = "transfer-source-search",
  label,
  locale,
  onChange,
  selectedPrefix,
  value,
}: {
  candidates: AdminExerciseItem[]
  /** Shown when nothing matches; defaults to the metadata-transfer wording. */
  emptyLabel?: string
  inputId?: string
  label: string
  locale: "en" | "vi"
  onChange: (id: string) => void
  /** Leads the line naming the picked variation. */
  selectedPrefix?: string
  value: string
}) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const selected = candidates.find((item) => item.id === value) ?? null
  const matches = useMemo(() => {
    const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return candidates
      .filter((item) => {
        const haystack = `${item.name} ${item.variationName} ${item.equipment ?? ""} ${item.muscleGroup}`.toLowerCase()
        return terms.every((term) => haystack.includes(term))
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [candidates, deferredQuery])
  const shown = matches.slice(0, TRANSFER_PICKER_LIMIT)

  // min-w-0 all the way down: the dialog is a grid, and a truncated row's
  // nowrap text would otherwise widen it past a phone screen.
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <InputWithIcon
        id={inputId}
        type="search"
        autoComplete="off"
        icon={<Search />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={locale === "en" ? "Search exercise, variation or equipment" : "Tìm bài, variation hoặc dụng cụ"}
      />
      <div role="listbox" aria-label={label} className="min-w-0 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-border">
        {shown.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel ?? (locale === "en" ? "No variation with media matches." : "Không có variation có media nào khớp.")}</p>
        ) : (
          shown.map((item) => {
            const active = item.id === value
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border/50 px-3 py-2 text-left transition-colors last:border-0 hover:bg-surface-hover",
                  active && "bg-primary-soft",
                )}
              >
                <ExerciseThumbnail media={item.media} name={item.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{item.name} · {item.variationName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[item.equipment, item.muscleGroup].filter(Boolean).join(" · ")} · {locale === "en" ? `${item.usageCount} uses` : `${item.usageCount} lượt dùng`}
                  </span>
                </span>
                {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
              </button>
            )
          })
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected
          ? `${selectedPrefix ?? (locale === "en" ? "Source" : "Nguồn")}: ${selected.name} · ${selected.variationName}`
          : matches.length > TRANSFER_PICKER_LIMIT
            ? locale === "en" ? `Showing ${TRANSFER_PICKER_LIMIT} of ${matches.length}. Type to narrow down.` : `Đang hiện ${TRANSFER_PICKER_LIMIT}/${matches.length}. Gõ để lọc thêm.`
            : locale === "en" ? `${matches.length} variations` : `${matches.length} variation`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AdminExercisesPanel (main export)                                    */
/* ------------------------------------------------------------------ */

export type ExerciseSaveData = {
  activityType: ExerciseActivityType
  id?: string
  mediaFiles?: AdminExerciseMediaFiles
  movementPattern: MovementPattern | null
  name: string
  variationName: string
  muscleGroup: string
  primaryMuscles: MuscleSlug[]
  secondaryMuscles: MuscleSlug[]
  equipment: string
  shareRequested?: boolean
}

type ExerciseLibraryPanelProps = {
  exercises: AdminExerciseItem[]
  actionKey: string | null
  importRequests?: AdminExerciseImportRequest[]
  locale: "en" | "vi"
  onSave: (data: ExerciseSaveData) => Promise<void>
  /** Admin only: without both handlers the edit dialog has no media section. */
  onSaveMedia?: (exerciseId: string, files: AdminExerciseMediaFiles) => Promise<void>
  onRemoveMedia?: (exerciseId: string) => Promise<void>
  onDelete: (exercise: AdminExerciseItem) => Promise<void>
  onBulkDelete: (ids: string[]) => Promise<void>
  onBulkApprove?: (ids: string[]) => Promise<void>
  onImport: () => void
  onDownloadTemplate: () => void
  onExportAll?: () => void
  onReviewImportRequest?: (requestId: string, status: "approved" | "rejected") => Promise<void>
  onTransferMetadata?: (sourceVariationId: string, targetVariationId: string) => Promise<void>
  onUndoMetadataTransfer?: (transferId: string, variationId: string) => Promise<void>
  /** Coach only: offer an own exercise to the shared library; also adds the offer to the create form. */
  onRequestShare?: (exercise: AdminExerciseItem) => Promise<void>
  /** Adds the AI pre-fill to the create form. */
  onAiDraft?: ExerciseFormModalProps["onAiDraft"]
  capabilities?: { canExport?: boolean; canBulkApprove?: boolean }
}

export function ExerciseLibraryPanel({
  exercises,
  actionKey,
  importRequests = [],
  locale,
  onSave,
  onSaveMedia,
  onRemoveMedia,
  onDelete,
  onBulkDelete,
  onBulkApprove,
  onImport,
  onDownloadTemplate,
  onExportAll,
  onReviewImportRequest,
  onTransferMetadata,
  onUndoMetadataTransfer,
  onRequestShare,
  onAiDraft,
  capabilities = {},
}: ExerciseLibraryPanelProps) {
  const copy = getExercisePanelCopy(locale)
  const [rawQ, setRawQ] = useState("")
  const q = useDeferredValue(rawQ)
  const [activeGroup, setActiveGroup] = useState<LibraryGroupKey | null>(null)
  const [modal, setModal] = useState<"new" | AdminExerciseItem | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<
    | { type: "single"; exercise: AdminExerciseItem }
    | { type: "bulk"; ids: string[] }
    | null
  >(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Checkboxes stay hidden, as in the browse design, until someone asks to select.
  const [selecting, setSelecting] = useState(false)
  const [muscleFilter, setMuscleFilter] = useState<"all" | MuscleSlug>("all")
  const [equipmentFilter, setEquipmentFilter] = useState("all")
  const [profileFilter, setProfileFilter] = useState<"all" | "pending" | "approved">("all")
  const [activityFilter, setActivityFilter] = useState<"all" | ExerciseActivityType>("all")
  const [mediaFilter, setMediaFilter] = useState<"all" | "missing" | "present">("all")
  const [sortBy, setSortBy] = useState<"popular" | "name">("popular")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [excelToolsOpen, setExcelToolsOpen] = useState(false)
  const [transferTarget, setTransferTarget] = useState<AdminExerciseItem | null>(null)
  const [transferSourceId, setTransferSourceId] = useState("")
  const transferBusyId = actionKey?.startsWith("exercise-metadata-transfer-") ? actionKey.slice("exercise-metadata-transfer-".length) : null

  function handleSearchChange(value: string) {
    setRawQ(value)
  }

  function resetFilters() {
    setRawQ("")
    setMuscleFilter("all")
    setEquipmentFilter("all")
    setProfileFilter("all")
    setActivityFilter("all")
    setMediaFilter("all")
    setSortBy("popular")
  }

  const equipmentOptions = useMemo(
    () => Array.from(new Set(exercises.map((exercise) => exercise.equipment?.trim()).filter(Boolean) as string[]))
      .sort((left, right) => left.localeCompare(right, locale, { sensitivity: "base" })),
    [exercises, locale],
  )

  const searchableExercises = useMemo(
    () => exercises.map((exercise) => ({
      document: createExerciseSearchDocument([
        exercise.name,
        exercise.variationName,
        exercise.muscleGroup,
        exercise.equipment,
        exercise.createdBy?.name,
      ]),
      exercise,
    })),
    [exercises],
  )

  /* Derived: every filter but equipment, which the group page's chips also offer */
  const searchResult = useMemo(
    () => {
      const search = compileExerciseSearch(q)
      const passesFilters = (e: AdminExerciseItem) => {
        if (
          muscleFilter !== "all" &&
          !e.primaryMuscles.includes(muscleFilter) &&
          !e.secondaryMuscles.includes(muscleFilter) &&
          !muscleGroupToSlugs(e.muscleGroup).includes(muscleFilter)
        ) return false
        if (profileFilter !== "all" && (e.muscleProfileStatus ?? "pending") !== profileFilter) return false
        if (activityFilter !== "all" && e.activityType !== activityFilter) return false
        if (mediaFilter !== "all" && Boolean(e.media) !== (mediaFilter === "present")) return false
        return true
      }

      // Exact matches first; typo-tolerant only when they find nothing.
      return filterExerciseSearch(
        searchableExercises,
        search,
        ({ document, exercise }, fuzzy) => passesFilters(exercise) && matchesExerciseSearchDocument(document, search, { fuzzy }),
      )
    },
    [activityFilter, mediaFilter, muscleFilter, profileFilter, q, searchableExercises],
  )
  const filteredBeforeEquipment = useMemo(() => searchResult.items.map(({ exercise }) => exercise), [searchResult])
  const filtered = useMemo(
    () => equipmentFilter === "all"
      ? filteredBeforeEquipment
      : filteredBeforeEquipment.filter((e) => (e.equipment ?? "").toLowerCase() === equipmentFilter.toLowerCase()),
    [equipmentFilter, filteredBeforeEquipment],
  )

  // The dialog reads the latest list entry, so a media upload shows up without reopening it.
  const editingExercise = typeof modal === "object" && modal !== null
    ? exercises.find((exercise) => exercise.id === modal.id) ?? modal
    : null

  const groupOf = useMemo(() => new Map(exercises.map((e) => [e.id, libraryGroupOf(e)])), [exercises])

  /* Grid cards: every group keeps its card, even when the filters empty it. */
  const groupCards = useMemo(
    () => LIBRARY_GROUPS.map((group) => ({ group, items: filtered.filter((e) => groupOf.get(e.id) === group.key) })),
    [filtered, groupOf],
  )

  /** Popular first, like the mockup's shelves; a search ranks by relevance instead. */
  const sortRows = useCallback(
    (items: AdminExerciseItem[]) => q.trim()
      ? sortByExerciseRelevance(items, q, (e) => e.name)
      : [...items].sort((left, right) =>
          sortBy === "popular"
            ? right.usageCount - left.usageCount || left.name.localeCompare(right.name, locale, { sensitivity: "base" })
            : left.name.localeCompare(right.name, locale, { sensitivity: "base" })),
    [locale, q, sortBy],
  )

  const activeGroupInfo = activeGroup ? getLibraryGroup(activeGroup) : null
  const activeRows = useMemo(
    () => activeGroup ? sortRows(filtered.filter((e) => groupOf.get(e.id) === activeGroup)) : [],
    [activeGroup, filtered, groupOf, sortRows],
  )
  const activeEquipmentChips = useMemo(
    () => activeGroup
      ? sortEquipmentChips(filteredBeforeEquipment.filter((e) => groupOf.get(e.id) === activeGroup).flatMap((e) => (e.equipment ? [e.equipment] : [])))
      : [],
    [activeGroup, filteredBeforeEquipment, groupOf],
  )
  /* A search on the grid page lists matches from every group instead of the cards. */
  const searchRows = useMemo(() => (!activeGroup && q.trim() ? sortRows(filtered) : []), [activeGroup, filtered, q, sortRows])
  const visibleRows = activeGroup ? activeRows : searchRows
  const isSearchPending = rawQ !== q

  /** "Use this one" from the create form: close it and show the existing exercise. */
  function showExistingExercise(id: string) {
    const existing = exercises.find((e) => e.id === id)
    setModal(null)
    if (!existing) return
    openGroup(groupOf.get(id) ?? null)
    setRawQ(existing.name)
  }

  function openGroup(key: LibraryGroupKey | null) {
    setActiveGroup(key)
    // Chips belong to one group; carrying a "Cable" chip into Abs would look like an empty group.
    setEquipmentFilter("all")
  }

  const rowHandlers: ExerciseRowActionHandlers = {
    approvingProfiles: actionKey === "exercise-bulk-approve",
    deletingId,
    onApproveProfile: capabilities.canBulkApprove && onBulkApprove ? (e) => void onBulkApprove([e.id]) : undefined,
    onDelete: (e) => void handleDelete(e),
    onEdit: (e) => setModal(e),
    onRequestShare: onRequestShare ? (e) => void onRequestShare(e).catch(() => undefined) : undefined,
    onTransferMetadata: onTransferMetadata ? (e) => { setTransferTarget(e); setTransferSourceId("") } : undefined,
    onUndoMetadataTransfer: onUndoMetadataTransfer
      ? (e) => { if (e.undoableMetadataTransferId) void onUndoMetadataTransfer(e.undoableMetadataTransferId, e.id).catch(() => undefined) }
      : undefined,
    transferringId: transferBusyId,
  }
  const selectableVisibleIds = visibleRows.filter((e) => ((e as AdminExerciseItem & { canManage?: boolean }).canManage ?? true)).map((e) => e.id)
  const allVisibleSelected = selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selected.has(id))
  const showCheckboxes = selecting || selected.size > 0

  function stopSelecting() {
    setSelected(new Set())
    setSelecting(false)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleGroupSelect(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev)
      const allIn = ids.every((id) => next.has(id))
      if (allIn) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }

  async function handleSave(data: FormData) {
    await onSave(data)
    setModal(null)
  }

  async function handleDelete(e: AdminExerciseItem) {
    setDeleteDialog({ type: "single", exercise: e })
  }

  async function confirmDelete() {
    if (!deleteDialog) return

    if (deleteDialog.type === "bulk") {
      await onBulkDelete(deleteDialog.ids)
      setSelected(new Set())
      setDeleteDialog(null)
      return
    }

    const e = deleteDialog.exercise
    setDeletingId(e.id)
    try {
      await onDelete(e)
      setDeleteDialog(null)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected)
    if (!ids.length) return
    setDeleteDialog({ type: "bulk", ids })
  }

  const isSaving =
    actionKey === "exercise-create" ||
    (typeof modal === "object" && modal !== null && actionKey === `exercise-update-${modal.id}`)

  const isBulkDeleting = actionKey === "exercise-bulk-delete"
  const isDeleting = Boolean(deletingId) || isBulkDeleting
  const deleteTitle = deleteDialog?.type === "single"
    ? copy.deleteConfirm(deleteDialog.exercise.name, deleteDialog.exercise.variationName)
    : deleteDialog?.type === "bulk"
      ? copy.deleteSelectedConfirm(deleteDialog.ids.length)
      : ""
  const deleteDescription = deleteDialog?.type === "bulk" ? copy.deleteSelectedDescription : copy.deleteDescription

  return (
    <div className="space-y-5">
      {activeGroupInfo ? (
        <div className="space-y-2">
          <nav aria-label={copy.breadcrumb} className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <button type="button" onClick={() => openGroup(null)} className="truncate hover:text-foreground hover:underline">
              {copy.libraryTitle}
            </button>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="truncate text-foreground">{activeGroupInfo.label[locale]}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {copy.libraryTitle}: {activeGroupInfo.label[locale]}
            </h2>
            <Badge variant="outline" className="rounded-full px-2.5 font-mono text-xs tnum">{activeRows.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{activeGroupInfo.description[locale]}</p>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{copy.libraryTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.libraryDescription}</p>
        </div>
      )}

      {importRequests.length > 0 ? (
        <Card>
          <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label-micro text-muted-foreground">{copy.pendingReview}</p>
              <h3 className="text-sm font-semibold text-foreground">
                {copy.coachExerciseImports}
              </h3>
            </div>
            <Badge variant="outline" className="w-fit font-mono text-micro">
              {importRequests.length} {copy.pending}
            </Badge>
          </div>
          <div className="divide-y divide-border">
            {importRequests.map((request) => (
              <div key={request.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {request.fileName ?? copy.untitledImport}
                    </p>
                    <Badge variant="secondary" className="font-mono text-micro">
                      {request.rowCount} {copy.rows}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.submittedBy} {request.submittedBy.name} ·{" "}
                    {request.createdAt.toLocaleString(locale === "en" ? "en-US" : "vi-VN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-transparent"
                    disabled={!onReviewImportRequest || actionKey === `exercise-import-review-${request.id}`}
                    onClick={() => void onReviewImportRequest?.(request.id, "rejected")}
                  >
                    <X className="h-4 w-4" />
                    {copy.reject}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!onReviewImportRequest || actionKey === `exercise-import-review-${request.id}`}
                    onClick={() => void onReviewImportRequest?.(request.id, "approved")}
                  >
                    {actionKey === `exercise-import-review-${request.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {copy.approve}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
        <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="contents">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-[280px] sm:max-w-[560px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-muted-foreground" />
            <Input
              value={rawQ}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-busy={isSearchPending}
              placeholder={locale === "en" ? "Search exercises, equipment, or muscle..." : "Tìm bài tập, dụng cụ hoặc nhóm cơ..."}
              className="h-11 min-w-0 bg-background pl-9 text-sm"
            />
          </div>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="h-11 shrink-0 whitespace-nowrap bg-background px-3 sm:min-w-[112px] sm:px-4">
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              <span>{locale === "en" ? "Filters" : "Bộ lọc"}</span>
            </Button>
          </DialogTrigger>
          <Button className="h-11 shrink-0 whitespace-nowrap px-3 sm:min-w-[152px] sm:px-4" onClick={() => setModal("new")}>
            <Plus className="h-4 w-4 mr-1.5" />
            <span>{copy.newExercise}</span>
          </Button>
        </div>

        {filtersOpen ? (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle>{locale === "en" ? "Filters" : "Bộ lọc"}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {locale === "en" ? "Refine the exercise library results." : "Thu hẹp kết quả trong thư viện bài tập."}
                  </DialogDescription>
                </div>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={resetFilters}>
                  <RotateCcw className="mr-1.5 size-4" />
                  {locale === "en" ? "Reset filters" : "Đặt lại bộ lọc"}
                </Button>
              </div>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
            <select className={NATIVE_SELECT_CLASS} value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value as typeof muscleFilter)}>
              <option value="all">{copy.profileFilterAll}</option>
              {MUSCLE_FILTERS.map((muscle) => <option key={muscle} value={muscle}>{formatMuscleSlug(muscle)}</option>)}
            </select>
            <select className={NATIVE_SELECT_CLASS} value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)}>
              <option value="all">{copy.equipmentFilterAll}</option>
              {equipmentOptions.map((equipment) => <option key={equipment} value={equipment}>{equipment}</option>)}
            </select>
            <select className={NATIVE_SELECT_CLASS} value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as typeof activityFilter)}>
              <option value="all">Activity: all</option>
              {ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select className={NATIVE_SELECT_CLASS} value={profileFilter} onChange={(event) => setProfileFilter(event.target.value as typeof profileFilter)}>
              <option value="all">{locale === "en" ? "Review: all" : "Duyệt: tất cả"}</option>
              <option value="pending">{copy.profileFilterPending}</option>
              <option value="approved">{copy.profileFilterApproved}</option>
            </select>
            <select
              aria-label="Media"
              className={NATIVE_SELECT_CLASS}
              value={mediaFilter}
              onChange={(event) => setMediaFilter(event.target.value as typeof mediaFilter)}
            >
              <option value="all">{locale === "en" ? "Media: all" : "Media: tất cả"}</option>
              <option value="missing">{locale === "en" ? "Missing media" : "Chưa có media"}</option>
              <option value="present">{locale === "en" ? "Has media" : "Đã có media"}</option>
            </select>
            <label className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span className="shrink-0">{locale === "en" ? "Sort by" : "Sắp xếp"}</span>
              <select
                className={cn(NATIVE_SELECT_CLASS, "flex-1")}
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              >
                <option value="popular">{locale === "en" ? "Most used" : "Dùng nhiều nhất"}</option>
                <option value="name">{locale === "en" ? "Name A-Z" : "Tên A-Z"}</option>
              </select>
            </label>
              </div>
          </DialogContent>
        ) : null}

        </Dialog>

        <Dialog open={excelToolsOpen} onOpenChange={setExcelToolsOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" className="h-11 shrink-0 whitespace-nowrap bg-card px-3 font-medium">
              <FileSpreadsheet className="mr-1.5 size-4 text-primary" />
              {copy.importExcel}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{locale === "en" ? "Excel tools" : "Công cụ Excel"}</DialogTitle>
              <DialogDescription>
                {locale === "en" ? "Import, export, or sync exercise data." : "Nhập, xuất hoặc đồng bộ dữ liệu bài tập."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" size="sm" className="h-9 justify-start bg-background" onClick={onImport}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" />
              {copy.importExcel}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 justify-start bg-background"
              onClick={onDownloadTemplate}
              disabled={actionKey === "exercise-template-download"}
            >
              {actionKey === "exercise-template-download"
                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                : <Download className="mr-1.5 h-4 w-4" />
              }
              {copy.downloadTemplate}
            </Button>
            {capabilities.canExport && onExportAll && (
              <Button variant="outline" size="sm" className="h-9 justify-start bg-background" onClick={onExportAll} disabled={actionKey === "exercise-export" || exercises.length === 0}>
                {actionKey === "exercise-export" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                {copy.exportAll}
              </Button>
            )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {copy.selected(selected.size)}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={stopSelecting}
          >
            {copy.deselectAll}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isBulkDeleting}
            onClick={() => void handleBulkDelete()}
          >
            {isBulkDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            {copy.deleteSelected(selected.size)}
          </Button>
          {capabilities.canBulkApprove && onBulkApprove ? (
            <Button size="sm" disabled={actionKey === "exercise-bulk-approve"} onClick={() => void onBulkApprove(Array.from(selected))}>
              {actionKey === "exercise-bulk-approve" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              {copy.approveProfiles}
            </Button>
          ) : null}
        </div>
      )}

      {activeGroup && activeEquipmentChips.length > 0 ? (
        // One scrolling row on phones, where wrapped chips would push the list off screen.
        <div role="group" aria-label={copy.equipment} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {["all", ...activeEquipmentChips].map((value) => {
            const active = equipmentFilter.toLowerCase() === value.toLowerCase()
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setEquipmentFilter(value)}
                className={cn(
                  "h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm transition-colors pointer-coarse:h-10",
                  active
                    ? "border-foreground bg-foreground font-medium text-background"
                    : "border-border bg-card text-foreground hover:bg-surface-hover",
                )}
              >
                {value === "all" ? copy.allEquipment : value}
              </button>
            )
          })}
        </div>
      ) : null}

      {activeGroup || q.trim() ? (
        <div className="space-y-3">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {searchResult.fuzzy && visibleRows.length > 0
                ? copy.fuzzyResults(q.trim(), visibleRows.length)
                : activeGroup ? copy.exerciseCount(visibleRows.length) : copy.searchResults(visibleRows.length)}
            </p>
            {selectableVisibleIds.length === 0 ? null : showCheckboxes ? (
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => toggleGroupSelect(selectableVisibleIds)}>
                  {allVisibleSelected ? copy.deselectAll : copy.selectAll}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={stopSelecting}>
                  {copy.doneSelecting}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelecting(true)}>
                {copy.selectMany}
              </Button>
            )}
          </div>
          {visibleRows.length > 0 ? (
            <ExerciseRowGrid
              exercises={visibleRows}
              handlers={rowHandlers}
              locale={locale}
              selected={showCheckboxes ? selected : undefined}
              onToggleSelect={showCheckboxes ? toggleSelect : undefined}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
              <Dumbbell aria-hidden className="size-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">{copy.noMatches}</p>
            </div>
          )}
        </div>
      ) : (
        <ExerciseGroupGrid groups={groupCards} locale={locale} onOpen={openGroup} />
      )}

      {/* Modal */}
      {modal !== null && (
        <ExerciseFormModal
          allowMedia={Boolean(onSaveMedia)}
          initial={modal === "new" ? null : editingExercise}
          locale={locale}
          offerShare={Boolean(onRequestShare)}
          duplicateCandidates={exercises}
          onUseExisting={showExistingExercise}
          onAiDraft={onAiDraft}
          mediaEditor={editingExercise && onSaveMedia && onRemoveMedia ? (
            <ExerciseMediaEditor
              exercise={editingExercise}
              locale={locale}
              onRemove={() => onRemoveMedia(editingExercise.id)}
              onSave={(files) => onSaveMedia(editingExercise.id, files)}
            />
          ) : undefined}
          saving={isSaving}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      <Dialog open={deleteDialog !== null} onOpenChange={(open) => {
        if (!open && !isDeleting) setDeleteDialog(null)
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="bg-transparent" onClick={() => setDeleteDialog(null)} disabled={isDeleting}>
              {copy.cancel}
            </Button>
            <Button type="button" variant="destructive" className="gap-2" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleteDialog?.type === "bulk" ? copy.deleteSelected(deleteDialog.ids.length) : copy.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferTarget !== null} onOpenChange={(open) => { if (!open && !transferBusyId) setTransferTarget(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{copy.transferTitle}</DialogTitle><DialogDescription>{copy.transferDescription}</DialogDescription></DialogHeader>
          {transferTarget ? <div className="min-w-0 space-y-4">
            <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs leading-5 text-warning-text">{copy.transferWarning}</p>
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm"><p className="label-micro text-muted-foreground">{copy.target}</p><p className="mt-1 font-medium">{transferTarget.name} · {transferTarget.variationName}</p><p className="text-xs text-muted-foreground">{transferTarget.media ? "Media ✓" : "Media —"} · {copy.usageCount(transferTarget.usageCount)}</p></div>
            <VariationSearchPicker
              candidates={exercises.filter((e) => e.id !== transferTarget.id && e.media)}
              label={copy.source}
              locale={locale}
              value={transferSourceId}
              onChange={setTransferSourceId}
            />
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setTransferTarget(null)} disabled={Boolean(transferBusyId)}>{copy.cancel}</Button><Button disabled={!transferSourceId || Boolean(transferBusyId)} onClick={() => transferTarget && onTransferMetadata?.(transferSourceId, transferTarget.id).then(() => setTransferTarget(null))}>{transferBusyId ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowDownUp className="mr-1.5 h-4 w-4" />}{copy.transfer}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AdminExercisesPanel(props: Omit<ExerciseLibraryPanelProps, "capabilities">) {
  return (
    <ExerciseLibraryPanel
      {...props}
      capabilities={{ canExport: true, canBulkApprove: true }}
    />
  )
}
