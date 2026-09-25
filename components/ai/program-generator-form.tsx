"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

import { ChoiceCard, ChoiceRow, MoreOptions, SingleChoice } from "@/components/ai/choice-controls"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/providers/locale-provider"

type FormValues = {
  goal: string
  experienceLevel: string
  daysPerWeek: number
  sessionDuration: number
  availableEquipment: string
  focusAreas: string[]
  injuries: string
  durationWeeks: number
}

const GOALS = [
  { value: "build_muscle", en: "Build muscle", vi: "Tăng cơ" },
  { value: "lose_weight", en: "Lose weight", vi: "Giảm cân" },
  { value: "strength", en: "Strength", vi: "Sức mạnh" },
  { value: "endurance", en: "Endurance", vi: "Sức bền" },
  { value: "general_fitness", en: "General", vi: "Tổng hợp" },
] as const

const LEVELS = [
  { value: "beginner", en: "Beginner", vi: "Mới tập", descEn: "Under 6 months", descVi: "Dưới 6 tháng tập" },
  { value: "intermediate", en: "Intermediate", vi: "Trung cấp", descEn: "6 months - 2 years", descVi: "6 tháng - 2 năm" },
  { value: "advanced", en: "Advanced", vi: "Nâng cao", descEn: "Over 2 years", descVi: "Trên 2 năm tập" },
] as const

const EQUIPMENT = [
  { value: "full_gym", en: "Full gym", vi: "Gym đầy đủ", descEn: "Machines, barbells and dumbbells", descVi: "Máy, tạ đòn và tạ đơn" },
  { value: "home_dumbbells", en: "Dumbbells", vi: "Tạ đôi", descEn: "No machines required", descVi: "Không cần máy tập" },
  { value: "bodyweight", en: "Bodyweight", vi: "Tay không", descEn: "No equipment required", descVi: "Không cần thiết bị" },
] as const

const DURATIONS = [4, 8, 12] as const
const SESSION_DURATIONS = [45, 60, 75, 90] as const
const DAYS_PER_WEEK = [3, 4, 5, 6] as const

/**
 * The multi-week program setup on one screen. It used to be a three-step
 * wizard; with every question a single compact row the whole setup fits a
 * phone, so the steps only added taps and hid answers behind "Continue".
 */
function ProgramGeneratorForm({
  initialValues,
  isLoading,
  onSubmit,
}: {
  /** Answers already known, e.g. the goal an onboarding trainee just picked. */
  initialValues?: Partial<FormValues>
  isLoading: boolean
  onSubmit: (values: FormValues) => void
}) {
  const { locale } = useLocale()
  const isVi = locale === "vi"
  const loadingStages = isVi
    ? ["Đang phân tích mục tiêu và trình độ...", "Đang xây dựng lịch tập phù hợp...", "Đang cân bằng nhóm cơ và khối lượng...", "Đang kiểm tra chấn thương và hoàn thiện..."]
    : ["Analyzing your goal and experience...", "Building a suitable schedule...", "Balancing muscle groups and volume...", "Checking limitations and finalizing..."]
  const [loadingStage, setLoadingStage] = useState(0)
  const [values, setValues] = useState<FormValues>({
    goal: "build_muscle",
    experienceLevel: "intermediate",
    daysPerWeek: 4,
    sessionDuration: 60,
    availableEquipment: "full_gym",
    focusAreas: [],
    injuries: "",
    durationWeeks: 8,
    ...initialValues,
  })
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!isLoading) {
      setLoadingStage(0)
      return
    }

    const timer = window.setInterval(() => {
      setLoadingStage((current) => Math.min(current + 1, loadingStages.length - 1))
    }, 1400)

    return () => window.clearInterval(timer)
  }, [isLoading, loadingStages.length])

  function toggleFocus(area: string) {
    setValues((current) => ({
      ...current,
      focusAreas: current.focusAreas.includes(area)
        ? current.focusAreas.filter((item) => item !== area)
        : [...current.focusAreas, area],
    }))
  }

  const label = (item: { en: string; vi: string }) => (isVi ? item.vi : item.en)
  const goal = GOALS.find((item) => item.value === values.goal) ?? GOALS[0]
  const level = LEVELS.find((item) => item.value === values.experienceLevel) ?? LEVELS[1]
  const equipment = EQUIPMENT.find((item) => item.value === values.availableEquipment) ?? EQUIPMENT[0]
  const perWeek = isVi ? "buổi/tuần" : "per week"
  const minutes = isVi ? "phút" : "min"
  const weeks = isVi ? "tuần" : "weeks"

  return (
    <div className="space-y-4">
      <ChoiceCard>
        <ChoiceRow label={isVi ? "Mục tiêu chính" : "Primary goal"}>
          <SingleChoice
            variant="chips"
            ariaLabel={isVi ? "Mục tiêu chính" : "Primary goal"}
            options={GOALS.map((item) => ({ label: label(item), value: item.value }))}
            value={values.goal}
            onChange={(value) => set("goal", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Kinh nghiệm" : "Experience"} hint={isVi ? level.descVi : level.descEn}>
          <SingleChoice
            ariaLabel={isVi ? "Kinh nghiệm" : "Experience"}
            options={LEVELS.map((item) => ({ label: label(item), value: item.value }))}
            value={values.experienceLevel}
            onChange={(value) => set("experienceLevel", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Số buổi mỗi tuần" : "Sessions per week"} hint={isVi ? "Chọn mức bạn duy trì được" : "Pick what you can keep up"}>
          <SingleChoice
            mono
            ariaLabel={isVi ? "Số buổi mỗi tuần" : "Sessions per week"}
            options={DAYS_PER_WEEK.map((days) => ({ ariaLabel: `${days} ${perWeek}`, label: String(days), value: days }))}
            value={values.daysPerWeek}
            onChange={(value) => set("daysPerWeek", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Thời lượng mỗi buổi" : "Session length"} hint={`${values.sessionDuration} ${minutes}`}>
          <SingleChoice
            mono
            ariaLabel={isVi ? "Thời lượng mỗi buổi" : "Session length"}
            options={SESSION_DURATIONS.map((duration) => ({ ariaLabel: `${duration} ${minutes}`, label: String(duration), value: duration }))}
            value={values.sessionDuration}
            onChange={(value) => set("sessionDuration", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Độ dài chương trình" : "Program length"} hint={`${values.durationWeeks} ${weeks}`}>
          <SingleChoice
            mono
            ariaLabel={isVi ? "Độ dài chương trình" : "Program length"}
            options={DURATIONS.map((duration) => ({ ariaLabel: `${duration} ${weeks}`, label: String(duration), value: duration }))}
            value={values.durationWeeks}
            onChange={(value) => set("durationWeeks", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Thiết bị" : "Equipment"} hint={isVi ? equipment.descVi : equipment.descEn}>
          <SingleChoice
            ariaLabel={isVi ? "Thiết bị" : "Equipment"}
            options={EQUIPMENT.map((item) => ({ label: label(item), value: item.value }))}
            value={values.availableEquipment}
            onChange={(value) => set("availableEquipment", value)}
          />
        </ChoiceRow>
      </ChoiceCard>

      <MoreOptions
        isVi={isVi}
        focusAreas={values.focusAreas}
        onToggleMuscle={toggleFocus}
        musclesLabel={isVi ? "Nhóm cơ muốn ưu tiên thêm volume" : "Muscles to give extra volume"}
        injuries={values.injuries}
        onInjuriesChange={(value) => set("injuries", value)}
        injuriesId="injuries"
        injuriesLabel={isVi ? "Chấn thương hoặc bài cần tránh" : "Injuries or exercises to avoid"}
        injuriesPlaceholder={isVi ? "Ví dụ: đau vai phải, tránh overhead press..." : "e.g. right shoulder pain, avoid overhead press..."}
      />

      <div className="glass-frost sticky bottom-3 z-20 rounded-3xl border p-3">
        {isLoading ? (
          <div className="flex min-h-12 items-center gap-3 px-2">
            <div className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft"><Loader2 className="size-5 animate-spin text-primary" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{loadingStages[loadingStage]}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${25 * (loadingStage + 1)}%` }} /></div></div>
          </div>
        ) : (
          <>
            {/* The answers at a glance, so a trainee can check them without scrolling back up. */}
            <p className="mb-2 truncate text-center text-xs text-muted-foreground">
              {label(goal)} · {values.daysPerWeek} {perWeek} · {values.durationWeeks} {weeks}
            </p>
            <Button type="button" size="lg" className="w-full gap-2 rounded-xl" onClick={() => onSubmit(values)}>
              <Sparkles className="size-4" />
              {isVi ? "Tạo chương trình bằng AI" : "Generate AI program"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export { ProgramGeneratorForm }
export type { FormValues }
