"use client"

import type { ReactNode } from "react"
import type { fetchExercises, fetchExerciseLibrary } from "@/lib/fitness/api"
import { useExercises, useExerciseLibrary } from "@/lib/queries/exercises"

export function ExerciseCacheSeed({ exercises, library, children }: {
  exercises: Awaited<ReturnType<typeof fetchExercises>>
  library: Awaited<ReturnType<typeof fetchExerciseLibrary>>
  children: ReactNode
}) {
  useExercises(undefined, exercises)
  useExerciseLibrary(undefined, library)
  return children
}
