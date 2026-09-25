"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useState } from "react"

import { ChoiceCard, ChoiceRow, MoreOptions, SingleChoice } from "@/components/ai/choice-controls"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/providers/locale-provider"

type DailyWorkoutFormValues = {
  goal: string
  experienceLevel: string
  sessionDuration: number
  availableEquipment: string
  focusAreas: string[]
  injuries: string
  energyLevel: "low" | "normal" | "high"
}

const GOALS = [
  { value: "build_muscle", en: "Build muscle", vi: "Tăng cơ" },
  { value: "lose_weight", en: "Burn fat", vi: "Đốt mỡ" },
  { value: "strength", en: "Strength", vi: "Sức mạnh" },
  { value: "endurance", en: "Endurance", vi: "Sức bền" },
  { value: "general_fitness", en: "General", vi: "Tổng hợp" },
] as const
const DURATIONS = [30, 45, 60, 75, 90] as const
const ENERGY = [
  { value: "low", en: "Tired", vi: "Hơi mệt", hintEn: "Lower volume", hintVi: "Giảm volume" },
  { value: "normal", en: "Normal", vi: "Bình thường", hintEn: "Standard volume", hintVi: "Volume chuẩn" },
  { value: "high", en: "Energized", vi: "Sung sức", hintEn: "Push harder", hintVi: "Có thể đẩy mạnh" },
] as const
const EQUIPMENT = [
  { value: "full_gym", en: "Full gym", vi: "Gym đầy đủ" },
  { value: "home_dumbbells", en: "Dumbbells", vi: "Tạ đôi" },
  { value: "bodyweight", en: "Bodyweight", vi: "Tay không" },
] as const

function DailyWorkoutGeneratorForm({ onSubmit, isLoading }: { onSubmit: (values: DailyWorkoutFormValues) => void; isLoading: boolean }) {
  const { locale } = useLocale()
  const isVi = locale === "vi"
  const [values, setValues] = useState<DailyWorkoutFormValues>({
    goal: "build_muscle",
    experienceLevel: "intermediate",
    sessionDuration: 60,
    availableEquipment: "full_gym",
    focusAreas: [],
    injuries: "",
    energyLevel: "normal",
  })
  const set = <K extends keyof DailyWorkoutFormValues>(key: K, value: DailyWorkoutFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  function toggleMuscle(muscle: string) {
    setValues((current) => ({
      ...current,
      focusAreas: current.focusAreas.includes(muscle)
        ? current.focusAreas.filter((item) => item !== muscle)
        : [...current.focusAreas, muscle],
    }))
  }

  const label = (item: { en: string; vi: string }) => (isVi ? item.vi : item.en)
  const goal = GOALS.find((item) => item.value === values.goal) ?? GOALS[0]
  const energy = ENERGY.find((item) => item.value === values.energyLevel) ?? ENERGY[1]
  const equipment = EQUIPMENT.find((item) => item.value === values.availableEquipment) ?? EQUIPMENT[0]
  const minutes = isVi ? "phút" : "min"

  return (
    <div className="space-y-4">
      <ChoiceCard>
        <ChoiceRow label={isVi ? "Mục tiêu hôm nay" : "Today's goal"}>
          <SingleChoice
            variant="chips"
            ariaLabel={isVi ? "Mục tiêu hôm nay" : "Today's goal"}
            options={GOALS.map((item) => ({ label: label(item), value: item.value }))}
            value={values.goal}
            onChange={(value) => set("goal", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Năng lượng" : "Energy"} hint={isVi ? energy.hintVi : energy.hintEn}>
          <SingleChoice
            ariaLabel={isVi ? "Năng lượng" : "Energy"}
            options={ENERGY.map((item) => ({ label: label(item), value: item.value }))}
            value={values.energyLevel}
            onChange={(value) => set("energyLevel", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Thời gian" : "Time"} hint={`${values.sessionDuration} ${minutes}`}>
          <SingleChoice
            mono
            ariaLabel={isVi ? "Thời gian" : "Time"}
            options={DURATIONS.map((duration) => ({ ariaLabel: `${duration} ${minutes}`, label: String(duration), value: duration }))}
            value={values.sessionDuration}
            onChange={(value) => set("sessionDuration", value)}
          />
        </ChoiceRow>
        <ChoiceRow label={isVi ? "Thiết bị" : "Equipment"}>
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
        onToggleMuscle={toggleMuscle}
        musclesLabel={isVi ? "Nhóm cơ muốn tập" : "Muscles to train"}
        injuries={values.injuries}
        onInjuriesChange={(value) => set("injuries", value)}
        injuriesId="daily-injuries"
        injuriesLabel={isVi ? "Đau mỏi hoặc bài cần tránh" : "Soreness or exercises to avoid"}
        injuriesPlaceholder={isVi ? "Ví dụ: cổ tay hơi đau, tránh chống đẩy..." : "e.g. sore wrist, avoid push-ups..."}
      />

      <div className="glass-frost sticky bottom-3 z-20 rounded-3xl border p-3">
        {/* The answers at a glance, so a trainee can check them without scrolling back up. */}
        <p className="mb-2 truncate text-center text-xs text-muted-foreground">
          {label(goal)} · {values.sessionDuration} {minutes} · {label(equipment)}
        </p>
        <Button size="lg" className="w-full gap-2 rounded-xl" disabled={isLoading} onClick={() => onSubmit(values)}>{isLoading ? <><Loader2 className="size-4 animate-spin" />{isVi ? "AI đang thiết kế buổi tập..." : "AI is building your workout..."}</> : <><Sparkles className="size-4" />{isVi ? "Tạo buổi tập hôm nay" : "Generate today's workout"}</>}</Button>
      </div>
    </div>
  )
}

export { DailyWorkoutGeneratorForm }
export type { DailyWorkoutFormValues }
