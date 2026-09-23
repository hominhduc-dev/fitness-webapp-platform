"use client"

import { addDays, format, isSameDay, startOfWeek } from "date-fns"
import { enUS, vi } from "date-fns/locale"

import { useLocale } from "@/components/providers/locale-provider"
import { useNutritionWeek } from "@/lib/queries/meals"
import { cn } from "@/lib/utils"

const RING_RADIUS = 16
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

/**
 * Monday–Sunday strip for picking the day. Each ring fills with that day's
 * calories against the goal; a dot marks today and a dashed ring the selected
 * day while it has nothing logged yet.
 */
export function WeeklyCalendarStrip({ onSelect, selectedDate }: { onSelect: (date: Date) => void; selectedDate: Date }) {
  const { locale } = useLocale()
  const dateLocale = locale === "vi" ? vi : enUS
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekQuery = useNutritionWeek(toDateKey(weekStart))
  const caloriesByDate = new Map(weekQuery.data?.days.map((day) => [day.date, day.calories]) ?? [])
  const target = weekQuery.data?.targetCalories ?? 0
  const today = new Date()

  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label={format(weekStart, "'Week of' dd/MM", { locale: dateLocale })}>
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(weekStart, index)
        const calories = caloriesByDate.get(toDateKey(day)) ?? 0
        const share = target > 0 ? calories / target : 0
        const selected = isSameDay(day, selectedDate)
        const isToday = isSameDay(day, today)
        const over = share > 1.1

        return (
          <button
            key={index}
            aria-current={isToday ? "date" : undefined}
            aria-label={format(day, "EEEE dd/MM", { locale: dateLocale })}
            aria-pressed={selected}
            className="flex flex-col items-center gap-1.5 rounded-xl py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40"
            type="button"
            onClick={() => onSelect(day)}
          >
            <span className={cn("size-1 rounded-full", isToday ? "bg-muted-foreground" : "bg-transparent")} />
            <span className={cn("text-sm", selected ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
              {format(day, "EEEEE", { locale: dateLocale })}
            </span>
            <svg className="size-9 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
              <circle
                className={selected && calories === 0 ? "text-foreground" : "text-muted-foreground/45"}
                cx="20"
                cy="20"
                fill="none"
                r={RING_RADIUS}
                stroke="currentColor"
                strokeDasharray={selected && calories === 0 ? "5 4" : undefined}
                strokeWidth="3"
              />
              {share > 0 ? (
                <circle
                  className={over ? "text-warning" : "text-primary"}
                  cx="20"
                  cy="20"
                  fill="none"
                  r={RING_RADIUS}
                  stroke="currentColor"
                  strokeDasharray={`${Math.min(share, 1) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                  strokeLinecap="round"
                  strokeWidth="3"
                />
              ) : null}
            </svg>
          </button>
        )
      })}
    </div>
  )
}
