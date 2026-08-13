"use client"

import { BatteryLow, BatteryMedium, BatteryFull, Check, Dumbbell, Flame, Heart, Loader2, Shield, Sparkles, Zap } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  { value: "build_muscle", label: "Tăng cơ", icon: Dumbbell },
  { value: "lose_weight", label: "Đốt mỡ", icon: Flame },
  { value: "strength", label: "Sức mạnh", icon: Shield },
  { value: "endurance", label: "Sức bền", icon: Heart },
  { value: "general_fitness", label: "Tổng hợp", icon: Zap },
] as const
const MUSCLES = ["Ngực", "Lưng", "Vai", "Tay trước", "Tay sau", "Chân", "Bụng", "Mông"] as const
const DURATIONS = [30, 45, 60, 75, 90] as const
const ENERGY = [
  { value: "low", label: "Hơi mệt", hint: "Giảm volume", icon: BatteryLow },
  { value: "normal", label: "Bình thường", hint: "Volume chuẩn", icon: BatteryMedium },
  { value: "high", label: "Sung sức", hint: "Có thể đẩy mạnh", icon: BatteryFull },
] as const
const EQUIPMENT = [
  { value: "full_gym", label: "Gym đầy đủ" },
  { value: "home_dumbbells", label: "Tạ đôi" },
  { value: "bodyweight", label: "Không thiết bị" },
] as const

function DailyWorkoutGeneratorForm({ onSubmit, isLoading }: { onSubmit: (values: DailyWorkoutFormValues) => void; isLoading: boolean }) {
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
        <Label className="mb-1 block text-base font-semibold">Hôm nay bạn muốn đạt điều gì?</Label>
        <p className="mb-4 text-xs text-muted-foreground">AI sẽ ưu tiên bài tập và rep range theo mục tiêu này.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {GOALS.map(({ value, label, icon: Icon }) => {
            const selected = values.goal === value
            return <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, goal: value }))} className={cn("relative flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-medium transition-all last:col-span-2 sm:last:col-span-1", selected ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40")}>{selected && <Check className="absolute right-2 top-2 size-3.5" />}<Icon className="size-5" />{label}</button>
          })}
        </div>
      </section>

      <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
        <Label className="mb-1 block text-base font-semibold">Bạn cảm thấy thế nào?</Label>
        <p className="mb-4 text-xs text-muted-foreground">AI dùng mức năng lượng để điều chỉnh số set và độ khó.</p>
        <div className="grid grid-cols-3 gap-2">
          {ENERGY.map(({ value, label, hint, icon: Icon }) => <button key={value} type="button" aria-pressed={values.energyLevel === value} onClick={() => setValues((current) => ({ ...current, energyLevel: value }))} className={cn("rounded-2xl border px-2 py-3 text-center transition-all", values.energyLevel === value ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}><Icon className={cn("mx-auto size-5", values.energyLevel === value ? "text-primary" : "text-muted-foreground")} /><span className="mt-2 block text-xs font-semibold sm:text-sm">{label}</span><span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">{hint}</span></button>)}
        </div>
      </section>

      <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label className="mb-2.5 block text-sm font-semibold">Thời gian có thể tập</Label>
            <div className="grid grid-cols-5 gap-1.5">{DURATIONS.map((duration) => <button key={duration} type="button" onClick={() => setValues((current) => ({ ...current, sessionDuration: duration }))} className={cn("rounded-xl border py-2.5 text-xs font-semibold transition-all", values.sessionDuration === duration ? "border-primary bg-primary-soft text-primary" : "border-border")}>{duration}</button>)}</div>
            <p className="mt-2 text-xs text-muted-foreground">{values.sessionDuration} phút</p>
          </div>
          <div>
            <Label className="mb-2.5 block text-sm font-semibold">Thiết bị hiện có</Label>
            <div className="grid grid-cols-3 gap-1.5">{EQUIPMENT.map((equipment) => <button key={equipment.value} type="button" onClick={() => setValues((current) => ({ ...current, availableEquipment: equipment.value }))} className={cn("rounded-xl border px-1 py-2.5 text-[11px] font-medium transition-all sm:text-xs", values.availableEquipment === equipment.value ? "border-primary bg-primary-soft text-primary" : "border-border")}>{equipment.label}</button>)}</div>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
        <Label className="mb-1 block text-base font-semibold">Nhóm cơ muốn tập hôm nay</Label>
        <p className="mb-4 text-xs text-muted-foreground">Có thể chọn nhiều nhóm hoặc để trống để AI tự cân đối.</p>
        <div className="flex flex-wrap gap-2">{MUSCLES.map((muscle) => { const selected = values.focusAreas.includes(muscle); return <button key={muscle} type="button" aria-pressed={selected} onClick={() => toggleMuscle(muscle)} className={cn("rounded-full border px-3.5 py-2 text-sm transition-all", selected ? "border-primary bg-primary-soft font-medium text-primary" : "border-border")}>{selected && <Check className="mr-1.5 inline size-3.5" />}{muscle}</button> })}</div>
      </section>

      <section className="glass-card rounded-[22px] border border-warning/20 bg-card p-4 sm:p-5">
        <Label htmlFor="daily-injuries" className="mb-1 block text-base font-semibold">Đau mỏi hoặc bài cần tránh?</Label>
        <p className="mb-3 text-xs text-muted-foreground">Bao gồm cả cảm giác bất thường chỉ xuất hiện hôm nay.</p>
        <textarea id="daily-injuries" rows={3} value={values.injuries} onChange={(event) => setValues((current) => ({ ...current, injuries: event.target.value }))} placeholder="Ví dụ: cổ tay hơi đau, tránh chống đẩy..." className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 text-sm outline-none focus:border-primary" />
      </section>

      <div className="glass-surface sticky bottom-3 z-20 rounded-[22px] border p-3 shadow-2xl backdrop-blur-xl">
        <Button size="lg" className="w-full gap-2 rounded-xl" disabled={isLoading} onClick={() => onSubmit(values)}>{isLoading ? <><Loader2 className="size-4 animate-spin" />AI đang thiết kế buổi tập...</> : <><Sparkles className="size-4" />Tạo buổi tập hôm nay</>}</Button>
      </div>
    </div>
  )
}

export { DailyWorkoutGeneratorForm }
export type { DailyWorkoutFormValues }
