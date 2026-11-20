"use client"

import { Eye } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { WorkoutPlanPreview } from "@/components/workout/workout-log-review"
import { getTotalSets } from "@/lib/fitness/routine-tag"
import type { Workout } from "@/lib/types"

/**
 * Read-only look at every exercise and set in a session before pressing Start.
 * The body is the same `WorkoutPlanPreview` the schedule's day preview uses, so
 * the two screens stay identical.
 */
export function WorkoutPreviewDialog({ workout, className }: { workout: Workout; className?: string }) {
  const { locale, messages } = useLocale()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={className ?? "h-10 justify-center gap-2 rounded-lg bg-transparent px-3 text-sm font-medium"}
        >
          <Eye className="h-4 w-4" />
          {messages.workoutPage.preview}
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[95] flex h-[calc(100svh-2rem)] max-h-[calc(100svh-2rem)] min-h-0 flex-col gap-0 overflow-hidden rounded-xl border-border p-0 sm:h-[86svh] sm:max-w-[820px]">
        <DialogHeader className="shrink-0 border-b border-border px-4 pb-4 pr-12 pt-5 text-left sm:px-6 sm:pr-12">
          <DialogTitle className="text-xl font-semibold leading-tight tracking-[0] text-foreground">
            {workout.name}
          </DialogTitle>
          <DialogDescription className="font-mono text-micro uppercase tracking-[0.08em]">
            {messages.workoutPage.previewWorkoutDescription(workout.exercises.length, getTotalSets(workout))}
          </DialogDescription>
        </DialogHeader>
        <WorkoutPlanPreview workout={workout} />
        <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {locale === "vi" ? "Đóng" : "Close"}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
