"use client"

import { Bot, ChevronRight, Dumbbell, Flame, Heart, Loader2, Shield, Sparkles, Zap } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

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
  { value: "build_muscle", label: "Tăng cơ", icon: Dumbbell },
  { value: "lose_weight", label: "Giảm cân", icon: Flame },
  { value: "strength", label: "Sức mạnh", icon: Shield },
  { value: "endurance", label: "Sức bền", icon: Heart },
  { value: "general_fitness", label: "Tổng hợp", icon: Zap },
] as const

const LEVELS = [
  { value: "beginner", label: "Mới bắt đầu", desc: "< 6 tháng tập" },
  { value: "intermediate", label: "Trung cấp", desc: "6 tháng - 2 năm" },
  { value: "advanced", label: "Nâng cao", desc: "> 2 năm tập" },
] as const

const EQUIPMENT = [
  { value: "full_gym", label: "Phòng gym đầy đủ" },
  { value: "home_dumbbells", label: "Tạ đôi tại nhà" },
  { value: "bodyweight", label: "Trọng lượng cơ thể" },
] as const

const DURATIONS = [4, 8, 12] as const
const SESSION_DURATIONS = [45, 60, 75, 90] as const
const DAYS_PER_WEEK = [3, 4, 5, 6] as const

const FOCUS_AREAS = [
  "Ngực", "Lưng", "Vai", "Tay trước", "Tay sau", "Chân", "Bụng", "Mông",
] as const

function ProgramGeneratorForm({ onSubmit, isLoading }: {
  onSubmit: (values: FormValues) => void
  isLoading: boolean
}) {
  const [values, setValues] = useState<FormValues>({
    goal: "build_muscle",
    experienceLevel: "intermediate",
    daysPerWeek: 4,
    sessionDuration: 60,
    availableEquipment: "full_gym",
    focusAreas: [],
    injuries: "",
    durationWeeks: 8,
  })

  function toggleFocus(area: string) {
    setValues((prev) => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area)
        ? prev.focusAreas.filter((a) => a !== area)
        : [...prev.focusAreas, area],
    }))
  }

  return (
    <div className="space-y-8">
      {/* Goal */}
      <section>
        <Label className="mb-3 block text-sm font-medium text-muted-foreground">Mục tiêu tập luyện</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {GOALS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValues((p) => ({ ...p, goal: value }))}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                values.goal === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Experience Level */}
      <section>
        <Label className="mb-3 block text-sm font-medium text-muted-foreground">Trình độ</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {LEVELS.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValues((p) => ({ ...p, experienceLevel: value }))}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                values.experienceLevel === value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50",
              )}
            >
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Schedule Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <section>
          <Label className="mb-3 block text-sm font-medium text-muted-foreground">Số buổi/tuần</Label>
          <div className="flex gap-2">
            {DAYS_PER_WEEK.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setValues((p) => ({ ...p, daysPerWeek: d }))}
                className={cn(
                  "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                  values.daysPerWeek === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        <section>
          <Label className="mb-3 block text-sm font-medium text-muted-foreground">Thời lượng (phút)</Label>
          <div className="flex gap-2">
            {SESSION_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setValues((p) => ({ ...p, sessionDuration: d }))}
                className={cn(
                  "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                  values.sessionDuration === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        <section>
          <Label className="mb-3 block text-sm font-medium text-muted-foreground">Thời gian (tuần)</Label>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setValues((p) => ({ ...p, durationWeeks: d }))}
                className={cn(
                  "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors",
                  values.durationWeeks === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Equipment */}
      <section>
        <Label className="mb-3 block text-sm font-medium text-muted-foreground">Thiết bị</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {EQUIPMENT.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValues((p) => ({ ...p, availableEquipment: value }))}
              className={cn(
                "rounded-xl border p-4 text-sm font-medium transition-colors",
                values.availableEquipment === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Focus Areas */}
      <section>
        <Label className="mb-3 block text-sm font-medium text-muted-foreground">
          Vùng tập trung <span className="text-xs font-normal">(tuỳ chọn)</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {FOCUS_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggleFocus(area)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                values.focusAreas.includes(area)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              {area}
            </button>
          ))}
        </div>
      </section>

      {/* Injuries */}
      <section>
        <Label htmlFor="injuries" className="mb-3 block text-sm font-medium text-muted-foreground">
          Chấn thương / hạn chế <span className="text-xs font-normal">(tuỳ chọn)</span>
        </Label>
        <Input
          id="injuries"
          placeholder="VD: Đau vai phải, tránh bài tập overhead press..."
          value={values.injuries}
          onChange={(e) => setValues((p) => ({ ...p, injuries: e.target.value }))}
        />
      </section>

      {/* Submit */}
      <Button
        className="w-full gap-2"
        size="lg"
        disabled={isLoading}
        onClick={() => onSubmit(values)}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            AI đang tạo chương trình...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Tạo chương trình AI
          </>
        )}
      </Button>
    </div>
  )
}

export { ProgramGeneratorForm }
export type { FormValues }
