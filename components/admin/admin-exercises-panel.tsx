"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  ArrowDownUp,
  ChevronDown,
  ChevronRight,
  Check,
  Download,
  FileSpreadsheet,
  ImageUp,
  Loader2,
  EllipsisVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react"

import { ExerciseMediaEditor } from "@/components/admin/exercise-media-editor"
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { MuscleProfileSummary, canApproveMuscleProfile } from "@/components/admin/muscle-profile-summary"
import { Badge } from "@/components/ui/badge"
import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import { MuscleMap, TRAINABLE_MUSCLE_SLUGS, type MuscleSlug as MapMuscleSlug } from "@/components/body/muscle-map"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  compileExerciseSearch,
  createExerciseSearchDocument,
  matchesExerciseSearchDocument,
  sortByExerciseRelevance,
  sortGroupsByExerciseRelevance,
} from "@/lib/exercise-search"
import { buildMuscleProfileHighlights, muscleGroupFromSlug, muscleGroupToSlugs } from "@/lib/fitness/muscle-map"
import { cn } from "@/lib/utils"
import type { AdminExerciseImportRequest, AdminExerciseItem, AdminExerciseMediaFiles } from "@/lib/admin/types"
import { EXERCISE_MEDIA_FILE_RULES, exerciseMediaFileProblem, exerciseMediaMaxMegabytes } from "@/lib/admin/exercise-media-files"
import type { ExerciseActivityType, MuscleSlug } from "@/lib/types"
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

const GROUP_DESCRIPTIONS: Record<string, string> = {
  arms: "Biceps, Triceps, Forearms",
  back: "Lats, Traps, Rhomboids, Lower Back",
  calves: "Calves, Soleus, Gastrocnemius",
  cardio: "Running, Cycling, Rowing, HIIT",
  chest: "Pectorals, Upper Chest, Lower Chest",
  core: "Abs, Obliques, Lower Back",
  glutes: "Glutes, Hip Extension",
  legs: "Quadriceps, Hamstrings, Glutes, Adductors",
  other: "Full Body, Mobility, Stretching, Sports",
  shoulders: "Deltoids, Traps, Rotator Cuff",
}

type FormData = {
  activityType: ExerciseActivityType
  id?: string
  mediaFiles?: AdminExerciseMediaFiles
  name: string
  variationName: string
  muscleGroup: string
  primaryMuscles: MuscleSlug[]
  secondaryMuscles: MuscleSlug[]
  equipment: string
}

function getExercisePanelCopy(locale: "en" | "vi") {
  return {
    addToLibrary: locale === "en" ? "Add to library" : "Thêm vào thư viện",
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
    downloadTemplate: locale === "en" ? "Download template" : "Tải file mẫu",
    exportAll: locale === "en" ? "Export Excel" : "Export Excel",
    transferMetadata: locale === "en" ? "Transfer metadata" : "Chuyển metadata",
    transferTitle: locale === "en" ? "Transfer exercise metadata" : "Chuyển metadata bài tập",
    transferDescription: locale === "en" ? "Choose a source variation. Its metadata will overwrite the target." : "Chọn variation nguồn. Metadata nguồn sẽ ghi đè metadata đích.",
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

type PrimaryMuscleSection = {
  key: string
  label: string
  items: AdminExerciseItem[]
}

function buildPrimaryMuscleSections(group: string, exercises: AdminExerciseItem[], locale: "en" | "vi"): PrimaryMuscleSection[] {
  const groupMuscles = muscleGroupToSlugs(group).filter((muscle): muscle is MuscleSlug => (MUSCLE_FILTERS as readonly string[]).includes(muscle))
  const sectionOrder = new Map<MuscleSlug, number>()
  groupMuscles.forEach((muscle, index) => sectionOrder.set(muscle, index))

  const sections = new Map<string, PrimaryMuscleSection>()
  const fallbackLabel = locale === "en" ? "Other primary" : "Primary khác"

  for (const exercise of exercises) {
    const primaryMuscle = exercise.primaryMuscles.find((muscle) => sectionOrder.has(muscle)) ?? exercise.primaryMuscles[0]
    const key = primaryMuscle ?? "__other-primary"
    const label = primaryMuscle ? formatMuscleSlug(primaryMuscle) : fallbackLabel
    const section = sections.get(key) ?? { key, label, items: [] }
    section.items.push(exercise)
    sections.set(key, section)
  }

  return Array.from(sections.values()).sort((left, right) => {
    const leftOrder = sectionOrder.get(left.key as MuscleSlug) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = sectionOrder.get(right.key as MuscleSlug) ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.label.localeCompare(right.label, locale === "vi" ? "vi" : "en", { sensitivity: "base" })
  })
}

function hasDraftMedia(files: AdminExerciseMediaFiles) {
  return Boolean(files.thumbnail || files.animation)
}

function hasCompleteDraftMedia(files: AdminExerciseMediaFiles) {
  return Boolean(files.thumbnail && files.animation)
}

function GroupMuscleIcon({ group }: { group: string }) {
  const slugs = muscleGroupToSlugs(group)
  const highlights = slugs.reduce<Partial<Record<MapMuscleSlug, string>>>((result, slug) => {
    result[slug as MapMuscleSlug] = "var(--primary)"
    return result
  }, {})

  return (
    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50">
      <MuscleMap
        side="front"
        highlights={highlights}
        defaultFill="color-mix(in oklab, var(--body-fill) 86%, white)"
        outline="var(--body-line)"
        className="h-10 w-auto"
      />
    </div>
  )
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

type ExerciseFormModalProps = {
  initial: AdminExerciseItem | null
  locale: "en" | "vi"
  /** Media upload for the exercise being edited; it saves independently of the form. */
  mediaEditor?: ReactNode
  saving: boolean
  onClose: () => void
  onSave: (data: FormData) => void
}

function ExerciseFormModal({ initial, locale, mediaEditor, saving, onClose, onSave }: ExerciseFormModalProps) {
  const copy = getExercisePanelCopy(locale)
  const [name, setName] = useState(initial?.name ?? "")
  const [variationName, setVariation] = useState(initial?.variationName === "Default" ? "" : (initial?.variationName ?? ""))
  const [muscleGroup, setMuscle] = useState(initial?.muscleGroup ?? MUSCLES[0])
  const [equipment, setEquipment] = useState(initial?.equipment ?? EQUIP[0])
  const [activityType, setActivityType] = useState<ExerciseActivityType>(initial?.activityType ?? "strength")
  const [primaryMuscles, setPrimaryMuscles] = useState<MuscleSlug[]>(initial?.primaryMuscles ?? [])
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleSlug[]>(initial?.secondaryMuscles ?? [])
  const [mediaFiles, setMediaFiles] = useState<AdminExerciseMediaFiles>({})
  const [targetRole, setTargetRole] = useState<"primary" | "secondary">("primary")

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

  function handleSave() {
    if (!canSave) return
    onSave({
      activityType,
      equipment,
      id: initial?.id,
      mediaFiles: !initial && hasCompleteDraftMedia(mediaFiles) ? mediaFiles : undefined,
      muscleGroup,
      name: name.trim(),
      primaryMuscles,
      secondaryMuscles,
      variationName: variationName.trim() || "Default",
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] max-w-[560px] flex-col gap-0 overflow-hidden rounded-xl p-0">
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
          {initial ? mediaEditor : (
            <CreateExerciseMediaDraft files={mediaFiles} locale={locale} onChange={setMediaFiles} />
          )}

          {/* Name */}
          <div>
            <Label className={EXERCISE_FORM_LABEL_CLASS}>{copy.exerciseName}</Label>
            <Input
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bench Press"
              autoFocus
            />
          </div>

          {/* Variation */}
          <div>
            <Label className={EXERCISE_FORM_LABEL_CLASS}>{copy.variation}</Label>
            <Input
              className="mt-1.5"
              value={variationName}
              onChange={(e) => setVariation(e.target.value)}
              placeholder={locale === "en" ? "e.g. Wide Grip" : "VD: Wide Grip"}
            />
          </div>

          <ExerciseComboboxSingleSelect
            label={locale === "en" ? "Exercise Type" : "Loại bài tập"}
            options={ACTIVITY_TYPES.map((type) => ({ label: type, value: type }))}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            value={activityType}
            onChange={(value) => setActivityType(value as ExerciseActivityType)}
          />

          <ExerciseComboboxSingleSelect
            label={copy.equipment}
            options={EQUIP.map((eq) => ({ label: eq, value: eq }))}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            value={equipment}
            onChange={setEquipment}
          />

          <MuscleComboboxMultiSelect
            label={locale === "en" ? "Primary Muscle Group" : "Cơ chính"}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            options={MUSCLE_FILTERS}
            selected={primaryMuscles}
            onChange={handlePrimaryMusclesChange}
          />

          <MuscleComboboxMultiSelect
            label={locale === "en" ? "Other Muscles" : "Cơ phụ"}
            placeholder={locale === "en" ? "Select..." : "Chọn..."}
            options={MUSCLE_FILTERS.filter((muscle) => !primaryMuscles.includes(muscle))}
            selected={secondaryMuscles}
            onChange={handleSecondaryMusclesChange}
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
              onMuscleClick={toggleMuscle}
            />
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Primary:</span> {primaryMuscles.join(", ") || "—"}</p>
              <p><span className="font-medium text-foreground">Secondary:</span> {secondaryMuscles.join(", ") || "—"}</p>
              {initial?.muscleProfileRationale ? <p>{initial.muscleProfileRationale}</p> : null}
            </div>
          </div>

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

/* ------------------------------------------------------------------ */
/* GroupBlock                                                            */
/* ------------------------------------------------------------------ */

type GroupBlockProps = {
  group: string
  exercises: AdminExerciseItem[]
  forceSectionOpen?: boolean
  open: boolean
  selected: Set<string>
  onToggle: () => void
  onToggleSelect: (id: string) => void
  onToggleGroupSelect: (ids: string[]) => void
  onEdit: (e: AdminExerciseItem) => void
  onDelete: (e: AdminExerciseItem) => void
  /** Approves one pending muscle profile; the row button is hidden without it. */
  onApproveProfile?: (e: AdminExerciseItem) => void
  approvingProfiles: boolean
  deletingId: string | null
  locale: "en" | "vi"
  onTransferMetadata?: (e: AdminExerciseItem) => void
  transferringId?: string | null
}

function GroupBlock({ group, exercises, forceSectionOpen = false, open, selected, onToggle, onToggleSelect, onToggleGroupSelect, onEdit, onDelete, onApproveProfile, approvingProfiles, deletingId, locale, onTransferMetadata, transferringId }: GroupBlockProps) {
  const copy = getExercisePanelCopy(locale)
  const [openSectionKeys, setOpenSectionKeys] = useState<Set<string>>(() => new Set())
  const selectableIds = exercises.filter((e) => ((e as AdminExerciseItem & { canManage?: boolean }).canManage ?? true)).map((e) => e.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const someSelected = selectableIds.some((id) => selected.has(id))
  const groupDescription = GROUP_DESCRIPTIONS[group.trim().toLowerCase()] ?? ""
  const primaryMuscleSections = buildPrimaryMuscleSections(group, exercises, locale)

  function toggleSection(sectionKey: string) {
    setOpenSectionKeys((current) => {
      const next = new Set(current)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })
  }

  const renderExerciseRow = (e: AdminExerciseItem) => {
    const canManage = (e as AdminExerciseItem & { canManage?: boolean }).canManage ?? true
    const canSelect = canManage
    const isSelected = selected.has(e.id)

    return (
      <div
        key={e.id}
        style={{ contentVisibility: "auto", containIntrinsicSize: "64px" }}
        className={cn(
          "grid grid-cols-[24px_minmax(0,1.4fr)_56px_84px] items-center gap-2 border-b border-border/50 px-4 py-2.5 last:border-0 sm:grid-cols-[24px_minmax(0,1.4fr)_minmax(0,1fr)_96px_64px_84px]",
          isSelected ? "bg-primary/5" : "hover:bg-muted/20",
        )}
      >
        <div className="flex items-center justify-center">
          {canSelect ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(e.id)}
            />
          ) : (
            <span className="h-4 w-4" />
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <ExerciseThumbnail media={e.media} name={e.name} previewable />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium text-foreground">{e.name}</span>
            </div>
            <MuscleProfileSummary exercise={e} locale={locale} />
            <span className="truncate text-micro text-muted-foreground sm:hidden">
              {e.variationName !== "Default" ? e.variationName : ""}
              {e.equipment ? `${e.variationName !== "Default" ? " · " : ""}${e.equipment}` : ""}
            </span>
          </div>
        </div>

        <span className="hidden truncate text-xs text-muted-foreground sm:block">{e.variationName !== "Default" ? e.variationName : ""}</span>
        <span className="hidden text-xs text-muted-foreground sm:block">{e.equipment ?? "—"}</span>
        <span className="text-right font-mono text-xs text-muted-foreground tnum">
          {e.usageCount}
        </span>

        <div className="flex items-center justify-end gap-0.5">
          {onApproveProfile && canManage && e.muscleProfileStatus === "pending" ? (
            <button
              type="button"
              aria-label={`${copy.approveProfile}: ${e.name}`}
              title={canApproveMuscleProfile(e) ? copy.approveProfile : copy.cannotApproveProfile}
              disabled={approvingProfiles || !canApproveMuscleProfile(e)}
              onClick={() => onApproveProfile(e)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`${locale === "en" ? "Actions" : "Thao tác"}: ${e.name}`}>
                {transferringId === e.id || deletingId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <EllipsisVertical className="h-4 w-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onTransferMetadata ? <DropdownMenuItem disabled={!canManage || transferringId === e.id} onSelect={() => onTransferMetadata(e)}><ArrowDownUp />{copy.transferMetadata}</DropdownMenuItem> : null}
              <DropdownMenuItem disabled={!canManage} onSelect={() => onEdit(e)}><Pencil />{copy.edit}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={!canManage || e.usageCount > 0 || deletingId === e.id} onSelect={() => onDelete(e)} title={!canManage ? copy.cannotManageShared : e.usageCount > 0 ? copy.cannotDeleteInUse : copy.delete}><Trash2 />{copy.delete}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* Group header */}
      <div className={cn("flex w-full items-center gap-3 px-4 py-2.5 transition-colors", open && "bg-muted/30")}>
        <button
          type="button"
          onClick={onToggle}
          className="grid flex-1 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 text-left hover:opacity-80"
        >
          <ChevronRight className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <GroupMuscleIcon group={group} />
          <span className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-base font-semibold text-foreground">{group}</span>
            <span className="hidden truncate text-sm text-muted-foreground md:block">{groupDescription}</span>
          </span>
          <span className="flex items-center justify-end gap-3 whitespace-nowrap">
            <span className="font-mono text-xs text-muted-foreground tnum">
              {copy.variationCount(exercises.length)}
            </span>
          </span>
          <span className="flex items-center gap-4">
            <ChevronRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
          </span>
        </button>
        {open && selectableIds.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            aria-label={`${allSelected ? copy.deselectAll : copy.selectGroup}: ${group}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggleGroupSelect(selectableIds)
            }}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 items-center justify-center rounded border border-input",
                (allSelected || someSelected) && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {allSelected ? <Check className="size-3" /> : someSelected ? <span className="h-0.5 w-2 rounded bg-current" /> : null}
            </span>
            <span className="hidden md:inline">{allSelected ? copy.deselectAll : copy.selectGroup}</span>
          </Button>
        ) : null}
      </div>

      {/* Exercise rows */}
      {open && (
        <div className="border-t border-border">
          {/* Column header */}
          <div className="grid grid-cols-[24px_minmax(0,1.4fr)_56px_84px] items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-2 sm:grid-cols-[24px_minmax(0,1.4fr)_minmax(0,1fr)_96px_64px_84px]">
            <span />
            <span className="label-micro text-muted-foreground">{copy.exercise}</span>
            <span className="label-micro hidden text-muted-foreground sm:block">{copy.variation}</span>
            <span className="label-micro hidden text-muted-foreground sm:block">{copy.equipment}</span>
            <span className="label-micro text-right text-muted-foreground">{copy.uses}</span>
            <span />
          </div>

          {primaryMuscleSections.map((section) => {
            const sectionOpen = forceSectionOpen || openSectionKeys.has(section.key)

            return (
              <div key={section.key} className="border-b border-border/50 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/40 bg-surface-subtle px-4 py-2 text-left transition-colors hover:bg-surface-hover sm:grid-cols-[24px_minmax(0,1fr)_96px_64px_84px]"
                  aria-expanded={sectionOpen}
                >
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", sectionOpen && "rotate-90")} />
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{section.label}</span>
                    <Badge variant="outline" className="font-mono text-micro">
                      {copy.variationCount(section.items.length)}
                    </Badge>
                  </div>
                  <span className="hidden sm:block" />
                  <span className="hidden sm:block" />
                  <span />
                </button>
                {sectionOpen ? section.items.map(renderExerciseRow) : null}
              </div>
            )
          })}
        </div>
      )}
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
  name: string
  variationName: string
  muscleGroup: string
  primaryMuscles: MuscleSlug[]
  secondaryMuscles: MuscleSlug[]
  equipment: string
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
  capabilities = {},
}: ExerciseLibraryPanelProps) {
  const copy = getExercisePanelCopy(locale)
  const [rawQ, setRawQ] = useState("")
  const q = useDeferredValue(rawQ)
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const [modal, setModal] = useState<"new" | AdminExerciseItem | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<
    | { type: "single"; exercise: AdminExerciseItem }
    | { type: "bulk"; ids: string[] }
    | null
  >(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [muscleFilter, setMuscleFilter] = useState<"all" | MuscleSlug>("all")
  const [equipmentFilter, setEquipmentFilter] = useState("all")
  const [profileFilter, setProfileFilter] = useState<"all" | "pending" | "approved">("all")
  const [activityFilter, setActivityFilter] = useState<"all" | ExerciseActivityType>("all")
  const [mediaFilter, setMediaFilter] = useState<"all" | "missing" | "present">("all")
  const [sortBy, setSortBy] = useState<"name" | "variations">("name")
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
    setSortBy("name")
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

  /* Derived: filter + group */
  const filtered = useMemo(
    () => {
      const search = compileExerciseSearch(q)

      return searchableExercises.flatMap(({ document, exercise: e }) => {
        if (!matchesExerciseSearchDocument(document, search)) return []
        if (
          muscleFilter !== "all" &&
          !e.primaryMuscles.includes(muscleFilter) &&
          !e.secondaryMuscles.includes(muscleFilter) &&
          !muscleGroupToSlugs(e.muscleGroup).includes(muscleFilter)
        ) return []
        if (equipmentFilter !== "all" && (e.equipment ?? "").toLowerCase() !== equipmentFilter.toLowerCase()) return []
        if (profileFilter !== "all" && (e.muscleProfileStatus ?? "pending") !== profileFilter) return []
        if (activityFilter !== "all" && e.activityType !== activityFilter) return []
        if (mediaFilter !== "all" && Boolean(e.media) !== (mediaFilter === "present")) return []
        return [e]
      })
    },
    [activityFilter, equipmentFilter, mediaFilter, muscleFilter, profileFilter, q, searchableExercises],
  )

  // The dialog reads the latest list entry, so a media upload shows up without reopening it.
  const editingExercise = typeof modal === "object" && modal !== null
    ? exercises.find((exercise) => exercise.id === modal.id) ?? modal
    : null

  const grouped = useMemo(() => {
    const map: Record<string, AdminExerciseItem[]> = {}
    filtered.forEach((e) => {
      const g = e.muscleGroup || "Other"
      ;(map[g] ??= []).push(e)
    })
    const groups = Object.keys(map).map((group) => ({ group, items: sortByExerciseRelevance(map[group], q, (e) => e.name) }))
    const sortedGroups = sortGroupsByExerciseRelevance(groups, q, (g) => g.group, (g) => g.items)
    if (q.trim()) return sortedGroups
    return sortedGroups.sort((left, right) =>
      sortBy === "variations"
        ? right.items.length - left.items.length
        : left.group.localeCompare(right.group, locale, { sensitivity: "base" }),
    )
  }, [filtered, locale, q, sortBy])

  /* Auto-expand when searching */
  const forceOpen = q.trim().length > 0
  const isSearchPending = rawQ !== q

  function toggle(g: string) {
    setOpenGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
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
      {importRequests.length > 0 ? (
        <div className="rounded-lg border border-border bg-card">
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
        </div>
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
                <option value="name">{locale === "en" ? "Name A-Z" : "Tên A-Z"}</option>
                <option value="variations">{locale === "en" ? "Most variations" : "Nhiều variation"}</option>
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
            onClick={() => setSelected(new Set())}
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

      {/* Groups */}
      <div className="flex flex-col gap-2.5">
        {grouped.map(({ group, items }) => (
          <GroupBlock
            key={group}
            group={group}
            exercises={items}
            forceSectionOpen={forceOpen}
            open={forceOpen || openGroups.includes(group)}
            selected={selected}
            onToggle={() => toggle(group)}
            onToggleSelect={toggleSelect}
            onToggleGroupSelect={toggleGroupSelect}
            onEdit={(e) => setModal(e)}
            onDelete={handleDelete}
            onApproveProfile={capabilities.canBulkApprove && onBulkApprove ? (e) => void onBulkApprove([e.id]) : undefined}
            approvingProfiles={actionKey === "exercise-bulk-approve"}
            deletingId={deletingId}
            onTransferMetadata={onTransferMetadata ? (e) => { setTransferTarget(e); setTransferSourceId("") } : undefined}
            transferringId={transferBusyId}
            locale={locale}
          />
        ))}
        {grouped.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            {copy.noMatches}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <ExerciseFormModal
          initial={modal === "new" ? null : editingExercise}
          locale={locale}
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
          {transferTarget ? <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm"><p className="label-micro text-muted-foreground">{copy.target}</p><p className="mt-1 font-medium">{transferTarget.name} · {transferTarget.variationName}</p><p className="text-xs text-muted-foreground">{transferTarget.media ? "Media ✓" : "Media —"} · {copy.usageCount(transferTarget.usageCount)}</p></div>
            <Label>{copy.source}</Label>
            <select value={transferSourceId} onChange={(e) => setTransferSourceId(e.target.value)} className={NATIVE_SELECT_CLASS}>
              <option value="">{locale === "en" ? "Select source variation" : "Chọn variation nguồn"}</option>
              {exercises.filter((e) => e.id !== transferTarget.id && e.media).sort((a,b) => a.name.localeCompare(b.name)).map((e) => <option key={e.id} value={e.id}>{e.name} · {e.variationName}</option>)}
            </select>
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
