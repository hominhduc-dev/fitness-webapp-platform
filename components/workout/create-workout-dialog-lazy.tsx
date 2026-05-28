"use client"

import type React from "react"

import dynamic from "next/dynamic"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Workout } from "@/lib/types"

type CreateWorkoutDialogLazyProps = {
  defaultScheduledDay?: number
  defaultScheduledDate?: Date
  onWorkoutSaved?: (workout: Workout, previousWorkout?: Workout) => void
  refreshOnSuccess?: boolean
  trigger?: React.ReactNode
  workoutTemplates?: Workout[]
  workoutToEdit?: Workout
}

const LazyDialog = dynamic(
  () => import("@/components/workout/create-workout-dialog").then((mod) => mod.CreateWorkoutDialog),
  {
    loading: () => (
      <Button disabled className="gap-1.5">
        <Plus className="h-4 w-4" />
        New workout
      </Button>
    ),
    ssr: false,
  },
)

export function CreateWorkoutDialogLazy(props: CreateWorkoutDialogLazyProps) {
  return <LazyDialog {...props} />
}
