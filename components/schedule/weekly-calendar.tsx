"use client"

import { useState } from "react"
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Workout, WeeklySchedule } from "@/lib/types"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

interface WeeklyCalendarProps {
  schedule: WeeklySchedule
  onAddWorkout?: (day: number) => void
  onEditWorkout?: (workout: Workout, day: number) => void
  onDeleteWorkout?: (day: number) => void
}

export function WeeklyCalendar({ schedule, onAddWorkout, onEditWorkout, onDeleteWorkout }: WeeklyCalendarProps) {
  const today = new Date().getDay()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">This Week</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Dec 15 - 21</span>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-transparent">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Desktop view - horizontal calendar */}
      <div className="hidden md:grid md:grid-cols-7 gap-2">
        {DAYS.map((day, idx) => {
          const workout = schedule[idx]
          const isToday = idx === today

          return (
            <div
              key={day}
              className={cn(
                "group relative rounded-xl border bg-card p-4 transition-all min-h-[180px]",
                isToday ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                selectedDay === idx && "ring-2 ring-primary",
              )}
              onClick={() => setSelectedDay(selectedDay === idx ? null : idx)}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={cn("text-sm font-medium", isToday ? "text-primary" : "text-muted-foreground")}>{day}</p>
                  <p className={cn("text-lg font-bold", isToday && "text-primary")}>{15 + idx}</p>
                </div>
                {isToday && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
              </div>

              {workout ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <p className="font-semibold text-primary text-sm">{workout.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {workout.exercises.length} exercises · {workout.duration} min
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditWorkout?.(workout, idx)
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteWorkout?.(idx)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddWorkout?.(idx)
                  }}
                  className="flex flex-col items-center justify-center w-full h-20 rounded-lg border-2 border-dashed border-muted hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Add Workout</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile view - list */}
      <div className="space-y-2 md:hidden">
        {FULL_DAYS.map((day, idx) => {
          const workout = schedule[idx]
          const isToday = idx === today

          return (
            <div
              key={day}
              className={cn(
                "rounded-xl border bg-card p-4 transition-all",
                isToday ? "border-primary/50 bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg font-bold",
                      isToday ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    {15 + idx}
                  </div>
                  <div>
                    <p className={cn("font-medium", isToday && "text-primary")}>
                      {day}
                      {isToday && <span className="ml-2 text-xs">(Today)</span>}
                    </p>
                    {workout ? (
                      <p className="text-sm text-muted-foreground">
                        {workout.name} · {workout.exercises.length} exercises
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Rest Day</p>
                    )}
                  </div>
                </div>

                {workout ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onAddWorkout?.(idx)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
