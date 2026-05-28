"use client"

import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CreateWorkoutDialogLazy } from "@/components/workout/create-workout-dialog-lazy"
import type { Workout } from "@/lib/types"

type EditWorkoutButtonProps = {
  workout: Workout
}

export function EditWorkoutButton({ workout }: EditWorkoutButtonProps) {
  return (
    <CreateWorkoutDialogLazy
      workoutToEdit={workout}
      trigger={
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 border-border/70 bg-background/80 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          aria-label="Edit workout"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  )
}
