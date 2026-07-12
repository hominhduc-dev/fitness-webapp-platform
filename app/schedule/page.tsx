"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { WeeklyCalendar } from "@/components/schedule/weekly-calendar"
import { AddWorkoutDialog } from "@/components/schedule/add-workout-dialog"
import { weeklySchedule, sampleWorkouts } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Plus, Copy } from "lucide-react"
import type { Workout, WeeklySchedule } from "@/lib/types"

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<WeeklySchedule>(weeklySchedule)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const handleAddWorkout = (day: number) => {
    setSelectedDay(day)
    setDialogOpen(true)
  }

  const handleCreateWorkout = (workout: Workout, day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: workout,
    }))
    setDialogOpen(false)
  }

  const handleSelectTemplate = (workout: Workout, day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: workout,
    }))
    setDialogOpen(false)
  }

  const handleEditWorkout = (workout: Workout, day: number) => {
    // For now, just open dialog to replace
    setSelectedDay(day)
    setDialogOpen(true)
  }

  const handleDeleteWorkout = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: null,
    }))
  }

  const handleCopyWeek = () => {
    // Create a new week with the same workouts
    const newSchedule: WeeklySchedule = {}
    Object.keys(schedule).forEach((dayStr) => {
      const day = parseInt(dayStr)
      newSchedule[day] = schedule[day]
    })
    setSchedule(newSchedule)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Weekly Schedule</h1>
                <p className="mt-1 text-muted-foreground">Plan and organize your training week</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 bg-transparent" onClick={handleCopyWeek}>
                  <Copy className="h-4 w-4" />
                  Copy Week
                </Button>
                <Button 
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => handleAddWorkout(new Date().getDay())}
                >
                  <Plus className="h-4 w-4" />
                  New Workout
                </Button>
              </div>
            </div>

            {/* Weekly Calendar */}
            <WeeklyCalendar
              schedule={schedule}
              onAddWorkout={handleAddWorkout}
              onEditWorkout={handleEditWorkout}
              onDeleteWorkout={handleDeleteWorkout}
            />

            {/* Workout Templates */}
            <div className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">Your Workout Templates</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sampleWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 cursor-pointer"
                    onClick={() => {
                      setSelectedDay(null)
                      setDialogOpen(true)
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{workout.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {workout.exercises.length} exercises · {workout.duration} min
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {[...new Set(workout.exercises.map((e) => e.exercise.muscleGroup))].map((group) => (
                        <span key={group} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {group}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />

        {/* Add Workout Dialog */}
        <AddWorkoutDialog
          open={dialogOpen}
          selectedDay={selectedDay}
          onClose={() => {
            setDialogOpen(false)
            setSelectedDay(null)
          }}
          onSubmit={handleCreateWorkout}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>
    </div>
  )
}
