"use client"

import { addDays, format, isAfter, isSameDay, startOfDay, startOfWeek } from "date-fns"
import { Check } from "lucide-react"
import { enUS, vi } from "date-fns/locale"

import { useLocale } from "@/components/providers/locale-provider"
import { useNutritionWeek } from "@/lib/queries/meals"
import { cn } from "@/lib/utils"
import { WeekDayCellContent, weekDayCellClass } from "@/components/layout/week-day-cell"
import { WEEK_STRIP_GRID_CLASS } from "@/components/layout/week-strip-layout"
import { shortWeekday } from "@/lib/i18n/weekday"

const RING_RADIUS = 16
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

/**
 * The day's calories against the goal as a small ring: green with a tick once
 * the goal is met, amber past 110%. On today's filled cell it draws in the
 * accent's foreground colour instead.
 */
function CalorieRing({ onAccent, share }: { onAccent: boolean; share: number }) {
  const over = share > 1.1
  const reached = share >= 1 && !over

  return (
    <span className="relative flex size-4 items-center justify-center">
      <svg className="size-4 -rotate-90" viewBox="0 0 40 40">
        <circle
          className={onAccent ? "text-primary-foreground/35" : "text-muted-foreground/40"}
          cx="20"
          cy="20"
          fill="none"
          r={RING_RADIUS}
          stroke="currentColor"
          strokeWidth="5"
        />
        {share > 0 ? (
          <circle
            className={onAccent ? "text-primary-foreground" : over ? "text-warning-text" : reached ? "text-success-text" : "text-primary"}
            cx="20"
            cy="20"
            fill="none"
            r={RING_RADIUS}
            stroke="currentColor"
            strokeDasharray={`${Math.min(share, 1) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeLinecap="round"
            strokeWidth="5"
          />
        ) : null}
      </svg>
      {reached ? (
        <Check className={cn("absolute size-2.5", onAccent ? "text-primary-foreground" : "text-success-text")} strokeWidth={3.5} />
      ) : null}
    </span>
  )
}

/**
 * Monday–Sunday strip for picking the day, in the same cell as Home's strip:
 * weekday, date, then the calorie ring. Today is filled, the selected day gets
 * a ring, and days still ahead are dimmed and show no ring.
 */
export function WeeklyCalendarStrip({ onSelect, selectedDate }: { onSelect: (date: Date) => void; selectedDate: Date }) {
  const { locale } = useLocale()
  const dateLocale = locale === "vi" ? vi : enUS
  const weekdayLocale = locale === "vi" ? "vi-VN" : "en-US"
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekQuery = useNutritionWeek(toDateKey(weekStart))
  const caloriesByDate = new Map(weekQuery.data?.days.map((day) => [day.date, day.calories]) ?? [])
  const target = weekQuery.data?.targetCalories ?? 0
  const today = startOfDay(new Date())

  return (
    <div className={WEEK_STRIP_GRID_CLASS} role="group" aria-label={format(weekStart, "'Week of' dd/MM", { locale: dateLocale })}>
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(weekStart, index)
        const calories = caloriesByDate.get(toDateKey(day)) ?? 0
        const share = target > 0 ? calories / target : 0
        const selected = isSameDay(day, selectedDate)
        const isToday = isSameDay(day, today)
        const future = isAfter(day, today)

        return (
          <button
            key={index}
            aria-current={isToday ? "date" : undefined}
            aria-label={format(day, "EEEE dd/MM", { locale: dateLocale })}
            aria-pressed={selected}
            className={weekDayCellClass({ future, isToday, selected })}
            type="button"
            onClick={() => onSelect(day)}
          >
            <WeekDayCellContent
              weekday={shortWeekday(day, weekdayLocale)}
              date={day.getDate()}
              isToday={isToday}
              indicator={future ? null : <CalorieRing onAccent={isToday} share={share} />}
            />
          </button>
        )
      })}
    </div>
  )
}
