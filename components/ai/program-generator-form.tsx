"use client"

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Dumbbell,
  Flame,
  Heart,
  Loader2,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
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
  { value: "beginner", label: "Mới bắt đầu", desc: "Dưới 6 tháng tập" },
  { value: "intermediate", label: "Trung cấp", desc: "6 tháng - 2 năm" },
  { value: "advanced", label: "Nâng cao", desc: "Trên 2 năm tập" },
] as const

const EQUIPMENT = [
  { value: "full_gym", label: "Phòng gym đầy đủ", desc: "Máy, tạ đòn và tạ đơn" },
  { value: "home_dumbbells", label: "Tạ đôi tại nhà", desc: "Không cần máy tập" },
  { value: "bodyweight", label: "Trọng lượng cơ thể", desc: "Không cần thiết bị" },
] as const

const STEPS = ["Mục tiêu", "Lịch tập", "Xác nhận"] as const
const LOADING_STAGES = [
  "Đang phân tích mục tiêu và trình độ...",
  "Đang xây dựng lịch tập phù hợp...",
  "Đang cân bằng nhóm cơ và khối lượng...",
  "Đang kiểm tra chấn thương và hoàn thiện...",
] as const
const DURATIONS = [4, 8, 12] as const
const SESSION_DURATIONS = [45, 60, 75, 90] as const
const DAYS_PER_WEEK = [3, 4, 5, 6] as const
const FOCUS_AREAS = ["Ngực", "Lưng", "Vai", "Tay trước", "Tay sau", "Chân", "Bụng", "Mông"] as const

function ProgramGeneratorForm({ onSubmit, isLoading }: { onSubmit: (values: FormValues) => void; isLoading: boolean }) {
  const [step, setStep] = useState(0)
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
  })

  useEffect(() => {
    if (!isLoading) {
      setLoadingStage(0)
      return
    }

    const timer = window.setInterval(() => {
      setLoadingStage((current) => Math.min(current + 1, LOADING_STAGES.length - 1))
    }, 1400)

    return () => window.clearInterval(timer)
  }, [isLoading])

  const summary = useMemo(() => {
    const goal = GOALS.find((item) => item.value === values.goal)?.label
    const level = LEVELS.find((item) => item.value === values.experienceLevel)?.label
    const equipment = EQUIPMENT.find((item) => item.value === values.availableEquipment)?.label
    return `${goal} · ${level} · ${values.daysPerWeek} buổi/tuần · ${values.sessionDuration} phút · ${equipment}`
  }, [values])

  function toggleFocus(area: string) {
    setValues((current) => ({
      ...current,
      focusAreas: current.focusAreas.includes(area)
        ? current.focusAreas.filter((item) => item !== area)
        : [...current.focusAreas, area],
    }))
  }

  return (
    <div className="space-y-5">
      <section className="glass-card rounded-[22px] border bg-card/80 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Thiết lập chương trình</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Khoảng 1 phút · AI chỉ dùng dữ liệu bạn cung cấp</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 font-mono text-xs font-semibold text-primary">
            {step + 1}/{STEPS.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="min-w-0">
              <div className={cn("h-1 rounded-full transition-colors", index <= step ? "bg-primary" : "bg-muted")} />
              <p className={cn("mt-2 truncate text-[11px] font-medium", index <= step ? "text-foreground" : "text-muted-foreground")}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {step === 0 && (
        <div className="space-y-5">
          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-1 block text-base font-semibold">Mục tiêu chính của bạn?</Label>
            <p className="mb-4 text-xs text-muted-foreground">AI sẽ dựa vào đây để chọn split, số set và rep range.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {GOALS.map(({ value, label, icon: Icon }) => {
                const selected = values.goal === value
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, goal: value }))} className={cn("relative flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-medium transition-all last:col-span-2 sm:last:col-span-1", selected ? "border-primary bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" : "border-border bg-background/30 hover:border-primary/40")}>
                    {selected && <Check className="absolute right-2 top-2 size-3.5" />}
                    <Icon className="size-5" />
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-3 block text-base font-semibold">Kinh nghiệm tập luyện</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVELS.map(({ value, label, desc }) => {
                const selected = values.experienceLevel === value
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, experienceLevel: value }))} className={cn("flex items-center justify-between rounded-2xl border p-4 text-left transition-all", selected ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}>
                    <span><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span></span>
                    {selected && <Check className="size-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="glass-card rounded-[22px] border border-warning/20 bg-card p-4 sm:p-5">
            <Label htmlFor="injuries" className="mb-1 block text-base font-semibold">Chấn thương hoặc bài cần tránh?</Label>
            <p className="mb-3 text-xs text-muted-foreground">Thông tin này giúp AI ưu tiên an toàn. Có thể bỏ trống nếu không có.</p>
            <textarea id="injuries" rows={3} placeholder="Ví dụ: đau vai phải, tránh overhead press..." value={values.injuries} onChange={(event) => setValues((current) => ({ ...current, injuries: event.target.value }))} className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
          </section>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-1 block text-base font-semibold">Lịch tập thực tế của bạn</Label>
            <p className="mb-5 text-xs text-muted-foreground">Chọn lịch bạn có thể duy trì đều đặn, không phải lịch lý tưởng.</p>
            <ChoiceRow label="Số buổi mỗi tuần" options={DAYS_PER_WEEK} value={values.daysPerWeek} onChange={(daysPerWeek) => setValues((current) => ({ ...current, daysPerWeek }))} suffix="buổi" />
            <ChoiceRow label="Thời lượng mỗi buổi" options={SESSION_DURATIONS} value={values.sessionDuration} onChange={(sessionDuration) => setValues((current) => ({ ...current, sessionDuration }))} suffix="phút" className="mt-5" />
            <ChoiceRow label="Độ dài chương trình" options={DURATIONS} value={values.durationWeeks} onChange={(durationWeeks) => setValues((current) => ({ ...current, durationWeeks }))} suffix="tuần" className="mt-5" />
          </section>

          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-3 block text-base font-semibold">Thiết bị bạn có</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {EQUIPMENT.map(({ value, label, desc }) => {
                const selected = values.availableEquipment === value
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, availableEquipment: value }))} className={cn("rounded-2xl border p-4 text-left transition-all", selected ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}>
                    <span className="flex items-center justify-between text-sm font-semibold">{label}{selected && <Check className="size-4 text-primary" />}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{desc}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-1 block text-base font-semibold">Nhóm cơ muốn ưu tiên</Label>
            <p className="mb-4 text-xs text-muted-foreground">Không bắt buộc. Chọn tối đa những vùng bạn muốn AI tăng thêm volume.</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREAS.map((area) => {
                const selected = values.focusAreas.includes(area)
                return <button key={area} type="button" aria-pressed={selected} onClick={() => toggleFocus(area)} className={cn("rounded-full border px-3.5 py-2 text-sm transition-all", selected ? "border-primary bg-primary-soft font-medium text-primary" : "border-border hover:border-primary/40")}>{selected && <Check className="mr-1.5 inline size-3.5" />}{area}</button>
              })}
            </div>
          </section>

          <section className="glass-card overflow-hidden rounded-[22px] border border-primary/20 bg-gradient-to-br from-primary-soft via-card to-card p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Bot className="size-5" /></div>
              <div>
                <p className="font-semibold">Sẵn sàng để AI thiết kế lịch tập</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">AI sẽ chọn split, bài tập, số set, reps, RIR và thời gian nghỉ dựa trên cấu hình này.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="label-micro mb-2">Cấu hình của bạn</p>
              <p className="text-sm font-medium leading-relaxed">{summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">{values.durationWeeks} tuần{values.focusAreas.length ? ` · Ưu tiên ${values.focusAreas.join(", ")}` : " · Cân bằng toàn thân"}{values.injuries ? " · Đã ghi nhận giới hạn vận động" : ""}</p>
            </div>
          </section>
        </div>
      )}

      <div className="glass-surface sticky bottom-3 z-20 rounded-[22px] border p-3 shadow-2xl backdrop-blur-xl">
        {isLoading ? (
          <div className="flex min-h-12 items-center gap-3 px-2">
            <div className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft"><Loader2 className="size-5 animate-spin text-primary" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{LOADING_STAGES[loadingStage]}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${25 * (loadingStage + 1)}%` }} /></div></div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {step > 0 && <Button type="button" variant="outline" size="lg" className="shrink-0 gap-1.5 rounded-xl" onClick={() => setStep((current) => current - 1)}><ArrowLeft className="size-4" /><span className="hidden sm:inline">Quay lại</span></Button>}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="lg" className="ml-auto flex-1 gap-2 rounded-xl sm:max-w-[220px]" onClick={() => { setStep((current) => current + 1); window.scrollTo({ top: 0, behavior: "smooth" }) }}>Tiếp tục<ArrowRight className="size-4" /></Button>
            ) : (
              <Button type="button" size="lg" className="ml-auto flex-1 gap-2 rounded-xl sm:max-w-[280px]" onClick={() => onSubmit(values)}><Sparkles className="size-4" />Tạo chương trình bằng AI</Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChoiceRow<T extends number>({ label, options, value, onChange, suffix, className }: { label: string; options: readonly T[]; value: T | number; onChange: (value: T) => void; suffix: string; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2.5 flex items-center justify-between"><span className="text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">Đã chọn: {value} {suffix}</span></div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={cn("rounded-xl border py-3 text-sm font-semibold transition-all", value === option ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40")}>{option}</button>)}
      </div>
    </div>
  )
}

export { ProgramGeneratorForm }
export type { FormValues }
