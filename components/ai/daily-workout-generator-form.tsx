"use client"

import { BatteryLow, BatteryMedium, BatteryFull, Check, Dumbbell, Flame, Heart, Loader2, Shield, Sparkles, Zap } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useLocale } from "@/components/providers/locale-provider"
import { cn } from "@/lib/utils"

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
  { value: "build_muscle", en: "Build muscle", vi: "Tăng cơ", icon: Dumbbell },
  { value: "lose_weight", en: "Burn fat", vi: "Đốt mỡ", icon: Flame },
  { value: "strength", en: "Strength", vi: "Sức mạnh", icon: Shield },
  { value: "endurance", en: "Endurance", vi: "Sức bền", icon: Heart },
  { value: "general_fitness", en: "General", vi: "Tổng hợp", icon: Zap },
] as const
const MUSCLES = [
  { value: "Chest", vi: "Ngực" }, { value: "Back", vi: "Lưng" }, { value: "Shoulders", vi: "Vai" },
  { value: "Biceps", vi: "Tay trước" }, { value: "Triceps", vi: "Tay sau" }, { value: "Legs", vi: "Chân" },
  { value: "Abs", vi: "Bụng" }, { value: "Glutes", vi: "Mông" },
] as const
const DURATIONS = [30, 45, 60, 75, 90] as const
const ENERGY = [
  { value: "low", en: "Tired", vi: "Hơi mệt", hintEn: "Lower volume", hintVi: "Giảm volume", icon: BatteryLow },
  { value: "normal", en: "Normal", vi: "Bình thường", hintEn: "Standard volume", hintVi: "Volume chuẩn", icon: BatteryMedium },
  { value: "high", en: "Energized", vi: "Sung sức", hintEn: "Push harder", hintVi: "Có thể đẩy mạnh", icon: BatteryFull },
] as const
const EQUIPMENT = [
  { value: "full_gym", en: "Full gym", vi: "Gym đầy đủ" },
  { value: "home_dumbbells", en: "Dumbbells", vi: "Tạ đôi" },
  { value: "bodyweight", en: "No equipment", vi: "Không thiết bị" },
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

  function toggleMuscle(muscle: string) {
    setValues((current) => ({
      ...current,
      focusAreas: current.focusAreas.includes(muscle)
        ? current.focusAreas.filter((item) => item !== muscle)
        : [...current.focusAreas, muscle],
    }))
  }

  return (
    <div className="space-y-5">
      <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
        <Label className="mb-1 block text-base font-semibold">{isVi ? "Hôm nay bạn muốn đạt điều gì?" : "What do you want to achieve today?"}</Label>
        <p className="mb-4 text-xs text-muted-foreground">{isVi ? "AI sẽ ưu tiên bài tập và rep range theo mục tiêu này." : "AI will prioritize exercises and rep ranges for this goal."}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {GOALS.map(({ value, en, vi, icon: Icon }) => {
            const selected = values.goal === value
            return <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, goal: value }))} className={cn("relative flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-medium transition-all last:col-span-2 sm:last:col-span-1", selected ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40")}>{selected && <Check className="absolute right-2 top-2 size-3.5" />}<Icon className="size-5" />{isVi ? vi : en}</button>
          })}
        </div>
      </section>

      <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
        <Label className="mb-1 block text-base font-semibold">{isVi ? "Bạn cảm thấy thế nào?" : "How are you feeling?"}</Label>
        <p className="mb-4 text-xs text-muted-foreground">{isVi ? "AI dùng mức năng lượng để điều chỉnh số set và độ khó." : "AI uses your energy level to adjust volume and difficulty."}</p>
        <div className="grid grid-cols-3 gap-2">
          {ENERGY.map(({ value, en, vi, hintEn, hintVi, icon: Icon }) => <button key={value} type="button" aria-pressed={values.energyLevel === value} onClick={() => setValues((current) => ({ ...current, energyLevel: value }))} className={cn("rounded-2xl border px-2 py-3 text-center transition-all", values.energyLevel === value ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}><Icon className={cn("mx-auto size-5", values.energyLevel === value ? "text-primary" : "text-muted-foreground")} /><span className="mt-2 block text-xs font-semibold sm:text-sm">{isVi ? vi : en}</span><span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{isVi ? hintVi : hintEn}</span></button>)}
        </div>
      </section>

      <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="mb-2.5 block text-sm font-semibold">{isVi ? "Thời gian có thể tập" : "Available training time"}</Label>
            <div className="grid grid-cols-5 gap-1.5">{DURATIONS.map((duration) => <button key={duration} type="button" onClick={() => setValues((current) => ({ ...current, sessionDuration: duration }))} className={cn("rounded-xl border py-2.5 text-xs font-semibold transition-all", values.sessionDuration === duration ? "border-primary bg-primary-soft text-primary" : "border-border")}>{duration}</button>)}</div>
            <p className="mt-2 text-xs text-muted-foreground">{values.sessionDuration} {isVi ? "phút" : "minutes"}</p>
          </div>
          <div>
            <Label className="mb-2.5 block text-sm font-semibold">{isVi ? "Thiết bị hiện có" : "Available equipment"}</Label>
            <div className="grid grid-cols-3 gap-1.5">{EQUIPMENT.map((equipment) => <button key={equipment.value} type="button" onClick={() => setValues((current) => ({ ...current, availableEquipment: equipment.value }))} className={cn("rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-all sm:text-xs", values.availableEquipment === equipment.value ? "border-primary bg-primary-soft text-primary" : "border-border")}>{isVi ? equipment.vi : equipment.en}</button>)}</div>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
        <Label className="mb-1 block text-base font-semibold">{isVi ? "Nhóm cơ muốn tập hôm nay" : "Muscles to train today"}</Label>
        <p className="mb-4 text-xs text-muted-foreground">{isVi ? "Có thể chọn nhiều nhóm hoặc để trống để AI tự cân đối." : "Select multiple groups or leave blank for AI to balance the session."}</p>
        <div className="flex flex-wrap gap-2">{MUSCLES.map((muscle) => { const selected = values.focusAreas.includes(muscle.value); return <button key={muscle.value} type="button" aria-pressed={selected} onClick={() => toggleMuscle(muscle.value)} className={cn("rounded-full border px-3.5 py-2 text-sm transition-all", selected ? "border-primary bg-primary-soft font-medium text-primary" : "border-border")}>{selected && <Check className="mr-1.5 inline size-3.5" />}{isVi ? muscle.vi : muscle.value}</button> })}</div>
      </section>

      <section className="glass-card rounded-[22px] border border-warning/20 bg-card p-4 sm:p-5">
        <Label htmlFor="daily-injuries" className="mb-1 block text-base font-semibold">{isVi ? "Đau mỏi hoặc bài cần tránh?" : "Any soreness or exercises to avoid?"}</Label>
        <p className="mb-3 text-xs text-muted-foreground">{isVi ? "Bao gồm cả cảm giác bất thường chỉ xuất hiện hôm nay." : "Include any discomfort that appeared today."}</p>
        <textarea id="daily-injuries" rows={3} value={values.injuries} onChange={(event) => setValues((current) => ({ ...current, injuries: event.target.value }))} placeholder={isVi ? "Ví dụ: cổ tay hơi đau, tránh chống đẩy..." : "e.g. sore wrist, avoid push-ups..."} className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 text-sm outline-none focus:border-primary" />
      </section>

      <div className="glass-surface sticky bottom-3 z-20 rounded-[22px] border p-3 shadow-2xl backdrop-blur-xl">
        <Button size="lg" className="w-full gap-2 rounded-xl" disabled={isLoading} onClick={() => onSubmit(values)}>{isLoading ? <><Loader2 className="size-4 animate-spin" />{isVi ? "AI đang thiết kế buổi tập..." : "AI is building your workout..."}</> : <><Sparkles className="size-4" />{isVi ? "Tạo buổi tập hôm nay" : "Generate today's workout"}</>}</Button>
      </div>
    </div>
  )
}

export { DailyWorkoutGeneratorForm }
export type { DailyWorkoutFormValues }
