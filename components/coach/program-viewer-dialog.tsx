"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { CoachProgram } from "@/lib/fitness/types"

interface ProgramViewerDialogProps {
  program: CoachProgram | null
  onClose: () => void
}

export function ProgramViewerDialog({ program, onClose }: ProgramViewerDialogProps) {
  const { locale, messages } = useLocale()
  const workoutsByWeek = new Map<number, CoachProgram["workouts"]>()

  for (const workout of program?.workouts ?? []) {
    const week = (workout.weekIndex ?? 0) + 1
    const workouts = workoutsByWeek.get(week) ?? []
    workouts.push(workout)
    workoutsByWeek.set(week, workouts)
  }

  return (
    <Dialog open={Boolean(program)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {program ? (
          <>
            <DialogHeader>
              <DialogTitle>{program.name}</DialogTitle>
              <DialogDescription>
                {messages.coach.weeks(program.duration)} · {messages.coach.daysPerWeek(program.workoutsPerWeek)}
                {program.description ? ` · ${program.description}` : ""}
              </DialogDescription>
            </DialogHeader>
            {workoutsByWeek.size === 0 ? (
              <p className="text-sm text-muted-foreground">{messages.coach.noProgramWorkouts}</p>
            ) : (
              <div className="space-y-5">
                {[...workoutsByWeek.entries()].sort(([a], [b]) => a - b).map(([week, workouts]) => (
                  <section key={week} className="space-y-2" aria-label={messages.coach.programWeek(week)}>
                    <h3 className="label-micro text-muted-foreground">{messages.coach.programWeek(week)}</h3>
                    {workouts.slice().sort((a, b) => (a.scheduledDay ?? 7) - (b.scheduledDay ?? 7)).map((workout) => (
                      <div key={workout.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="font-medium">{workout.name}</h4>
                          {workout.scheduledDay !== undefined ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { weekday: "short" }).format(new Date(2024, 0, 7 + workout.scheduledDay))}
                            </span>
                          ) : null}
                        </div>
                        {workout.exercises.length > 0 ? (
                          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                            {workout.exercises.map((exercise) => (
                              <li key={exercise.id} className="flex justify-between gap-3">
                                <span>{exercise.variation.displayName || exercise.variation.name}</span>
                                <span className="shrink-0 font-mono text-xs tnum">
                                  {exercise.sets.length} × {exercise.sets[0]?.targetRepsMin ? `${exercise.sets[0].targetRepsMin}–` : ""}{exercise.sets[0]?.targetReps ?? "—"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
