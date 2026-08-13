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
import { useLocale } from "@/components/providers/locale-provider"
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
  { value: "build_muscle", en: "Build muscle", vi: "Tăng cơ", icon: Dumbbell },
  { value: "lose_weight", en: "Lose weight", vi: "Giảm cân", icon: Flame },
  { value: "strength", en: "Strength", vi: "Sức mạnh", icon: Shield },
  { value: "endurance", en: "Endurance", vi: "Sức bền", icon: Heart },
  { value: "general_fitness", en: "General", vi: "Tổng hợp", icon: Zap },
] as const

const LEVELS = [
  { value: "beginner", en: "Beginner", vi: "Mới bắt đầu", descEn: "Under 6 months", descVi: "Dưới 6 tháng tập" },
  { value: "intermediate", en: "Intermediate", vi: "Trung cấp", descEn: "6 months - 2 years", descVi: "6 tháng - 2 năm" },
  { value: "advanced", en: "Advanced", vi: "Nâng cao", descEn: "Over 2 years", descVi: "Trên 2 năm tập" },
] as const

const EQUIPMENT = [
  { value: "full_gym", en: "Full gym", vi: "Phòng gym đầy đủ", descEn: "Machines, barbells and dumbbells", descVi: "Máy, tạ đòn và tạ đơn" },
  { value: "home_dumbbells", en: "Home dumbbells", vi: "Tạ đôi tại nhà", descEn: "No machines required", descVi: "Không cần máy tập" },
  { value: "bodyweight", en: "Bodyweight", vi: "Trọng lượng cơ thể", descEn: "No equipment required", descVi: "Không cần thiết bị" },
] as const

const DURATIONS = [4, 8, 12] as const
const SESSION_DURATIONS = [45, 60, 75, 90] as const
const DAYS_PER_WEEK = [3, 4, 5, 6] as const
const FOCUS_AREAS = [
  { value: "Chest", vi: "Ngực" }, { value: "Back", vi: "Lưng" }, { value: "Shoulders", vi: "Vai" },
  { value: "Biceps", vi: "Tay trước" }, { value: "Triceps", vi: "Tay sau" }, { value: "Legs", vi: "Chân" },
  { value: "Abs", vi: "Bụng" }, { value: "Glutes", vi: "Mông" },
] as const

function ProgramGeneratorForm({ onSubmit, isLoading }: { onSubmit: (values: FormValues) => void; isLoading: boolean }) {
  const { locale } = useLocale()
  const isVi = locale === "vi"
  const steps = isVi ? ["Mục tiêu", "Lịch tập", "Xác nhận"] : ["Goal", "Schedule", "Review"]
  const loadingStages = isVi
    ? ["Đang phân tích mục tiêu và trình độ...", "Đang xây dựng lịch tập phù hợp...", "Đang cân bằng nhóm cơ và khối lượng...", "Đang kiểm tra chấn thương và hoàn thiện..."]
    : ["Analyzing your goal and experience...", "Building a suitable schedule...", "Balancing muscle groups and volume...", "Checking limitations and finalizing..."]
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
      setLoadingStage((current) => Math.min(current + 1, loadingStages.length - 1))
    }, 1400)

    return () => window.clearInterval(timer)
  }, [isLoading, loadingStages.length])

  const summary = useMemo(() => {
    const goalItem = GOALS.find((item) => item.value === values.goal)
    const levelItem = LEVELS.find((item) => item.value === values.experienceLevel)
    const equipmentItem = EQUIPMENT.find((item) => item.value === values.availableEquipment)
    return `${isVi ? goalItem?.vi : goalItem?.en} · ${isVi ? levelItem?.vi : levelItem?.en} · ${values.daysPerWeek} ${isVi ? "buổi/tuần" : "days/week"} · ${values.sessionDuration} ${isVi ? "phút" : "min"} · ${isVi ? equipmentItem?.vi : equipmentItem?.en}`
  }, [isVi, values])

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
            <p className="text-sm font-semibold">{isVi ? "Thiết lập chương trình" : "Program setup"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{isVi ? "Khoảng 1 phút · AI chỉ dùng dữ liệu bạn cung cấp" : "About 1 minute · AI only uses the data you provide"}</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1 font-mono text-xs font-semibold text-primary">
            {step + 1}/{steps.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {steps.map((label, index) => (
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
            <Label className="mb-1 block text-base font-semibold">{isVi ? "Mục tiêu chính của bạn?" : "What is your primary goal?"}</Label>
            <p className="mb-4 text-xs text-muted-foreground">{isVi ? "AI sẽ dựa vào đây để chọn split, số set và rep range." : "AI uses this to choose the split, sets, and rep ranges."}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {GOALS.map(({ value, en, vi, icon: Icon }) => {
                const selected = values.goal === value
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, goal: value }))} className={cn("relative flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-medium transition-all last:col-span-2 sm:last:col-span-1", selected ? "border-primary bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" : "border-border bg-background/30 hover:border-primary/40")}>
                    {selected && <Check className="absolute right-2 top-2 size-3.5" />}
                    <Icon className="size-5" />
                    {isVi ? vi : en}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-3 block text-base font-semibold">{isVi ? "Kinh nghiệm tập luyện" : "Training experience"}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {LEVELS.map(({ value, en, vi, descEn, descVi }) => {
                const selected = values.experienceLevel === value
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, experienceLevel: value }))} className={cn("flex items-center justify-between rounded-2xl border p-4 text-left transition-all", selected ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}>
                    <span><span className="block text-sm font-semibold">{isVi ? vi : en}</span><span className="mt-0.5 block text-xs text-muted-foreground">{isVi ? descVi : descEn}</span></span>
                    {selected && <Check className="size-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="glass-card rounded-[22px] border border-warning/20 bg-card p-4 sm:p-5">
            <Label htmlFor="injuries" className="mb-1 block text-base font-semibold">{isVi ? "Chấn thương hoặc bài cần tránh?" : "Any injuries or exercises to avoid?"}</Label>
            <p className="mb-3 text-xs text-muted-foreground">{isVi ? "Thông tin này giúp AI ưu tiên an toàn. Có thể bỏ trống nếu không có." : "This helps AI prioritize safety. Leave blank if none."}</p>
            <textarea id="injuries" rows={3} placeholder={isVi ? "Ví dụ: đau vai phải, tránh overhead press..." : "e.g. right shoulder pain, avoid overhead press..."} value={values.injuries} onChange={(event) => setValues((current) => ({ ...current, injuries: event.target.value }))} className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
          </section>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-1 block text-base font-semibold">{isVi ? "Lịch tập thực tế của bạn" : "Your realistic training schedule"}</Label>
            <p className="mb-5 text-xs text-muted-foreground">{isVi ? "Chọn lịch bạn có thể duy trì đều đặn, không phải lịch lý tưởng." : "Choose a schedule you can maintain consistently."}</p>
            <ChoiceRow label={isVi ? "Số buổi mỗi tuần" : "Sessions per week"} options={DAYS_PER_WEEK} value={values.daysPerWeek} onChange={(daysPerWeek) => setValues((current) => ({ ...current, daysPerWeek }))} suffix={isVi ? "buổi" : "sessions"} selectedLabel={isVi ? "Đã chọn" : "Selected"} />
            <ChoiceRow label={isVi ? "Thời lượng mỗi buổi" : "Session duration"} options={SESSION_DURATIONS} value={values.sessionDuration} onChange={(sessionDuration) => setValues((current) => ({ ...current, sessionDuration }))} suffix={isVi ? "phút" : "minutes"} selectedLabel={isVi ? "Đã chọn" : "Selected"} className="mt-5" />
            <ChoiceRow label={isVi ? "Độ dài chương trình" : "Program length"} options={DURATIONS} value={values.durationWeeks} onChange={(durationWeeks) => setValues((current) => ({ ...current, durationWeeks }))} suffix={isVi ? "tuần" : "weeks"} selectedLabel={isVi ? "Đã chọn" : "Selected"} className="mt-5" />
          </section>

          <section className="glass-card rounded-[22px] border bg-card p-4 sm:p-5">
            <Label className="mb-3 block text-base font-semibold">{isVi ? "Thiết bị bạn có" : "Available equipment"}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {EQUIPMENT.map(({ value, en, vi, descEn, descVi }) => {
                const selected = values.availableEquipment === value
                return (
                  <button key={value} type="button" aria-pressed={selected} onClick={() => setValues((current) => ({ ...current, availableEquipment: value }))} className={cn("rounded-2xl border p-4 text-left transition-all", selected ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}>
                    <span className="flex items-center justify-between text-sm font-semibold">{isVi ? vi : en}{selected && <Check className="size-4 text-primary" />}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{isVi ? descVi : descEn}</span>
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
            <Label className="mb-1 block text-base font-semibold">{isVi ? "Nhóm cơ muốn ưu tiên" : "Priority muscle groups"}</Label>
            <p className="mb-4 text-xs text-muted-foreground">{isVi ? "Không bắt buộc. Chọn tối đa những vùng bạn muốn AI tăng thêm volume." : "Optional. Select areas where you want AI to add more volume."}</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_AREAS.map((area) => {
                const selected = values.focusAreas.includes(area.value)
                return <button key={area.value} type="button" aria-pressed={selected} onClick={() => toggleFocus(area.value)} className={cn("rounded-full border px-3.5 py-2 text-sm transition-all", selected ? "border-primary bg-primary-soft font-medium text-primary" : "border-border hover:border-primary/40")}>{selected && <Check className="mr-1.5 inline size-3.5" />}{isVi ? area.vi : area.value}</button>
              })}
            </div>
          </section>

          <section className="glass-card overflow-hidden rounded-[22px] border border-primary/20 bg-gradient-to-br from-primary-soft via-card to-card p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Bot className="size-5" /></div>
              <div>
                <p className="font-semibold">{isVi ? "Sẵn sàng để AI thiết kế lịch tập" : "Ready for AI to design your program"}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{isVi ? "AI sẽ chọn split, bài tập, số set, reps, RIR và thời gian nghỉ dựa trên cấu hình này." : "AI will choose the split, exercises, sets, reps, RIR, and rest times from this setup."}</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-4">
              <p className="label-micro mb-2">{isVi ? "Cấu hình của bạn" : "Your configuration"}</p>
              <p className="text-sm font-medium leading-relaxed">{summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">{values.durationWeeks} {isVi ? "tuần" : "weeks"}{values.focusAreas.length ? ` · ${isVi ? "Ưu tiên" : "Focus"} ${values.focusAreas.join(", ")}` : isVi ? " · Cân bằng toàn thân" : " · Full-body balance"}{values.injuries ? isVi ? " · Đã ghi nhận giới hạn vận động" : " · Movement limitations noted" : ""}</p>
            </div>
          </section>
        </div>
      )}

      <div className="glass-surface sticky bottom-3 z-20 rounded-[22px] border p-3 shadow-2xl backdrop-blur-xl">
        {isLoading ? (
          <div className="flex min-h-12 items-center gap-3 px-2">
            <div className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft"><Loader2 className="size-5 animate-spin text-primary" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{loadingStages[loadingStage]}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${25 * (loadingStage + 1)}%` }} /></div></div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {step > 0 && <Button type="button" variant="outline" size="lg" className="shrink-0 gap-1.5 rounded-xl" onClick={() => setStep((current) => current - 1)}><ArrowLeft className="size-4" /><span className="hidden sm:inline">{isVi ? "Quay lại" : "Back"}</span></Button>}
            {step < steps.length - 1 ? (
              <Button type="button" size="lg" className="ml-auto flex-1 gap-2 rounded-xl sm:max-w-[220px]" onClick={() => { setStep((current) => current + 1); window.scrollTo({ top: 0, behavior: "smooth" }) }}>{isVi ? "Tiếp tục" : "Continue"}<ArrowRight className="size-4" /></Button>
            ) : (
              <Button type="button" size="lg" className="ml-auto flex-1 gap-2 rounded-xl sm:max-w-[280px]" onClick={() => onSubmit(values)}><Sparkles className="size-4" />{isVi ? "Tạo chương trình bằng AI" : "Generate AI program"}</Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChoiceRow<T extends number>({ label, options, value, onChange, suffix, selectedLabel, className }: { label: string; options: readonly T[]; value: T | number; onChange: (value: T) => void; suffix: string; selectedLabel: string; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2.5 flex items-center justify-between"><span className="text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{selectedLabel}: {value} {suffix}</span></div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={cn("rounded-xl border py-3 text-sm font-semibold transition-all", value === option ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary/40")}>{option}</button>)}
      </div>
    </div>
  )
}

export { ProgramGeneratorForm }
export type { FormValues }
