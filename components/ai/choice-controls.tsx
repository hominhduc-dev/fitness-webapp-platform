"use client"

import { ShieldCheck, SlidersHorizontal } from "lucide-react"
import type { ReactNode } from "react"

import { DisclosureCard } from "@/components/ui/disclosure-card"
import { FilterChip } from "@/components/ui/filter-chip"
import { GlassSegmented } from "@/components/ui/glass-segmented"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Shared building blocks of the AI builder forms (today's workout and the
 * multi-week program): every question is one row with a compact glass
 * control, and the optional answers sit in a collapsed "more options" card.
 */

export const MUSCLE_OPTIONS = [
  { value: "Chest", vi: "Ngực" }, { value: "Back", vi: "Lưng" }, { value: "Shoulders", vi: "Vai" },
  { value: "Biceps", vi: "Tay trước" }, { value: "Triceps", vi: "Tay sau" }, { value: "Legs", vi: "Chân" },
  { value: "Abs", vi: "Bụng" }, { value: "Glutes", vi: "Mông" },
] as const

/** One question: a label, what the current answer means, and its control. */
export function ChoiceRow({ children, hint, label }: { children: ReactNode; hint?: ReactNode; label: string }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="shrink-0 text-sm font-semibold text-foreground">{label}</p>
        {hint ? <p className="min-w-0 truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

/** The card the question rows sit in, with a hairline between rows. */
export function ChoiceCard({ children }: { children: ReactNode }) {
  return <section className="glass-card divide-y divide-border rounded-3xl border bg-card p-4 sm:p-5">{children}</section>
}

/**
 * A single-answer question. `segments` is an inset track of equal columns the
 * lens slides along; `chips` wraps pills onto rows for longer lists (no slide:
 * a drag reads one axis only).
 */
export function SingleChoice<T extends string | number>({
  ariaLabel,
  mono = false,
  onChange,
  options,
  value,
  variant = "segments",
}: {
  ariaLabel: string
  mono?: boolean
  onChange: (value: T) => void
  options: ReadonlyArray<{ ariaLabel?: string; label: string; value: T }>
  value: T
  variant?: "chips" | "segments"
}) {
  const activeIndex = options.findIndex((option) => option.value === value)
  const chips = variant === "chips"

  return (
    <GlassSegmented
      role="radiogroup"
      aria-label={ariaLabel}
      activeIndex={activeIndex}
      columns={chips ? undefined : { count: options.length, gapPx: 4 }}
      lensClassName={chips ? "rounded-full" : "rounded-xl"}
      onSlide={chips ? undefined : (index) => onChange(options[index].value)}
      className={chips ? "flex flex-wrap gap-1.5" : "grid gap-1 rounded-2xl bg-muted/60 p-1"}
      style={chips ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {(shownIndex) =>
        options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-segment
            aria-checked={option.value === value}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              "text-sm font-medium transition-colors pointer-coarse:min-h-11",
              chips
                ? cn("inline-flex items-center rounded-full border px-3.5 py-2", index === shownIndex ? "border-transparent" : "border-border")
                : "flex min-w-0 items-center justify-center rounded-xl px-1.5 py-2",
              mono && "font-mono tnum",
              index === shownIndex ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate">{option.label}</span>
          </button>
        ))
      }
    </GlassSegmented>
  )
}

/**
 * The optional answers — muscles to favour and what to avoid — folded away.
 * Closed, it still says what is set, so nothing hides behind it unnoticed.
 */
export function MoreOptions({
  focusAreas,
  injuries,
  injuriesId,
  injuriesLabel,
  injuriesPlaceholder,
  isVi,
  musclesLabel,
  onInjuriesChange,
  onToggleMuscle,
}: {
  focusAreas: string[]
  injuries: string
  injuriesId: string
  injuriesLabel: string
  injuriesPlaceholder: string
  isVi: boolean
  musclesLabel: string
  onInjuriesChange: (value: string) => void
  onToggleMuscle: (muscle: string) => void
}) {
  const muscleNames = MUSCLE_OPTIONS.filter((muscle) => focusAreas.includes(muscle.value)).map((muscle) => (isVi ? muscle.vi : muscle.value))
  const summary =
    [
      muscleNames.length > 0 ? muscleNames.join(", ") : null,
      injuries.trim() ? (isVi ? "Có ghi chú cần tránh" : "Limitations noted") : null,
    ]
      .filter(Boolean)
      .join(" · ") || (isVi ? "Nhóm cơ, bài cần tránh — để trống AI tự cân đối" : "Muscles, things to avoid — leave blank to let AI balance it")

  return (
    <DisclosureCard
      className="rounded-3xl"
      icon={<SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      title={isVi ? "Tùy chỉnh thêm" : "More options"}
      description={summary}
    >
      <div className="space-y-4 border-t border-border pt-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">{musclesLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_OPTIONS.map((muscle) => {
              const selected = focusAreas.includes(muscle.value)
              return (
                <FilterChip key={muscle.value} active={selected} aria-pressed={selected} onClick={() => onToggleMuscle(muscle.value)} className="px-3.5 py-2 text-sm pointer-coarse:min-h-11">
                  {isVi ? muscle.vi : muscle.value}
                </FilterChip>
              )
            })}
          </div>
        </div>
        <div>
          <Label htmlFor={injuriesId} className="mb-2 block text-sm font-semibold">{injuriesLabel}</Label>
          <textarea
            id={injuriesId}
            rows={2}
            value={injuries}
            onChange={(event) => onInjuriesChange(event.target.value)}
            placeholder={injuriesPlaceholder}
            className="w-full resize-none rounded-xl border border-border bg-background/50 px-3.5 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-success-text" aria-hidden="true" />
            {isVi ? "AI sẽ tránh các bài gây tải lên vùng này." : "AI steers clear of loading these areas."}
          </p>
        </div>
      </div>
    </DisclosureCard>
  )
}
