"use client"

import { ArrowRight, RotateCcw, SlidersHorizontal } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ExerciseActivityType, MuscleSlug } from "@/lib/types"

type MuscleFilter = "all" | MuscleSlug
type ActivityFilter = "all" | ExerciseActivityType
type ProfileFilter = "all" | "pending" | "approved"
type MediaFilter = "all" | "missing" | "present"
type SortOrder = "popular" | "name"

export type ExerciseLibraryFiltersProps = {
  showReview?: boolean
  showPopularity?: boolean
  locale: "en" | "vi"
  muscleFilter: MuscleFilter
  equipmentFilter: string
  activityFilter: ActivityFilter
  profileFilter: ProfileFilter
  mediaFilter: MediaFilter
  sortBy: SortOrder
  equipmentOptions: string[]
  resultCount: number
  onMuscleChange: (value: MuscleFilter) => void
  onEquipmentChange: (value: string) => void
  onActivityChange: (value: ActivityFilter) => void
  onProfileChange: (value: ProfileFilter) => void
  onMediaChange: (value: MediaFilter) => void
  onSortChange: (value: SortOrder) => void
  onReset: () => void
  onClose: () => void
}

const MUSCLES: MuscleSlug[] = [
  "abs", "adductors", "biceps", "calves", "chest", "deltoids", "forearm", "gluteal",
  "hamstring", "lower-back", "obliques", "quadriceps", "tibialis", "trapezius", "triceps", "upper-back",
]

const ACTIVITIES: { value: ExerciseActivityType; en: string; vi: string }[] = [
  { value: "strength", en: "Strength", vi: "Sức mạnh" },
  { value: "cardio", en: "Cardio", vi: "Tim mạch" },
  { value: "mobility", en: "Mobility", vi: "Linh hoạt" },
  { value: "sport", en: "Sport", vi: "Thể thao" },
  { value: "other", en: "Other", vi: "Khác" },
]

const SELECT_CLASS = "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm [color-scheme:light] dark:[color-scheme:dark] [&_option]:bg-background [&_option]:text-foreground"

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

export function ExerciseLibraryFilters({
  locale, muscleFilter, equipmentFilter, activityFilter, profileFilter, mediaFilter,
  sortBy, equipmentOptions, resultCount, onMuscleChange, onEquipmentChange,
  onActivityChange, onProfileChange, onMediaChange, onSortChange, onReset, onClose,
  showReview = true,
  showPopularity = true,
}: ExerciseLibraryFiltersProps) {
  const isEnglish = locale === "en"
  const all = isEnglish ? "All" : "Tất cả"
  const activeCount = [muscleFilter, equipmentFilter, activityFilter, ...(showReview ? [profileFilter] : []), mediaFilter].filter((value) => value !== "all").length

  return (
    <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
      <DialogHeader className="shrink-0 px-4 pb-3 pt-4 pr-12 text-left">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden="true">
            <SlidersHorizontal className="size-4" />
          </span>
          <div>
            <DialogTitle className="text-base leading-tight">{isEnglish ? "Filter exercises" : "Lọc bài tập"}</DialogTitle>
            <DialogDescription className="sr-only">
              {isEnglish ? "Results update as you choose." : "Kết quả cập nhật ngay khi bạn chọn."}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <FilterField label={isEnglish ? "Target muscle" : "Cơ mục tiêu"}>
              <select className={SELECT_CLASS} value={muscleFilter} onChange={(event) => onMuscleChange(event.target.value as MuscleFilter)}>
                <option value="all">{all}</option>
                {MUSCLES.map((muscle) => <option key={muscle} value={muscle}>{muscle.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}</option>)}
              </select>
            </FilterField>
            <FilterField label={isEnglish ? "Equipment" : "Dụng cụ"}>
              <select className={SELECT_CLASS} value={equipmentFilter} onChange={(event) => onEquipmentChange(event.target.value)}>
                <option value="all">{all}</option>
                {equipmentOptions.map((equipment) => <option key={equipment} value={equipment}>{equipment}</option>)}
              </select>
            </FilterField>
            <FilterField label={isEnglish ? "Activity type" : "Loại hoạt động"}>
              <select className={SELECT_CLASS} value={activityFilter} onChange={(event) => onActivityChange(event.target.value as ActivityFilter)}>
                <option value="all">{all}</option>
                {ACTIVITIES.map((activity) => <option key={activity.value} value={activity.value}>{activity[locale]}</option>)}
              </select>
            </FilterField>
            {showReview ? <FilterField label={isEnglish ? "Muscle review" : "Duyệt thông tin cơ"}>
              <select className={SELECT_CLASS} value={profileFilter} onChange={(event) => onProfileChange(event.target.value as ProfileFilter)}>
                <option value="all">{all}</option>
                <option value="pending">{isEnglish ? "Needs review" : "Chờ duyệt"}</option>
                <option value="approved">{isEnglish ? "Approved" : "Đã duyệt"}</option>
              </select>
            </FilterField> : null}
            <FilterField label={isEnglish ? "Media" : "Hình ảnh / video"}>
              <select className={SELECT_CLASS} value={mediaFilter} onChange={(event) => onMediaChange(event.target.value as MediaFilter)}>
                <option value="all">{all}</option>
                <option value="present">{isEnglish ? "Has media" : "Có media"}</option>
                <option value="missing">{isEnglish ? "Missing media" : "Chưa có media"}</option>
              </select>
            </FilterField>
            <FilterField label={isEnglish ? "Sort by" : "Sắp xếp theo"}>
              <select className={SELECT_CLASS} value={sortBy} onChange={(event) => onSortChange(event.target.value as SortOrder)}>
                {showPopularity ? <option value="popular">{isEnglish ? "Most used" : "Dùng nhiều nhất"}</option> : null}
                <option value="name">{isEnglish ? "Name A–Z" : "Tên A–Z"}</option>
              </select>
            </FilterField>
          </div>
      </div>

      <div className="shrink-0 space-y-3 border-t border-border bg-muted/20 px-4 py-3">
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm" role="status" aria-atomic="true">
          <span className="font-medium text-foreground">{resultCount.toLocaleString(locale)} {isEnglish ? "exercises found" : "bài tập phù hợp"}</span>
          <span className="text-xs text-muted-foreground">
            {activeCount === 0
              ? (isEnglish ? "No filters selected" : "Chưa chọn bộ lọc")
              : (isEnglish ? `${activeCount} filters selected` : `${activeCount} bộ lọc đã chọn`)}
          </span>
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-11 bg-background" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {isEnglish ? "Reset" : "Đặt lại"}
          </Button>
          <Button type="button" className="h-11 flex-1 sm:ml-auto sm:flex-none sm:px-6" onClick={onClose}>
            {isEnglish ? "Show results" : "Xem kết quả"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}
