import { AuthServiceError } from "../../services/errors"

type WorkoutOutput = {
  workouts: Array<{ exercises: Array<{ sets: number; reps: number; repsMin?: number }> }>
}

// Both model output and previously persisted JSON cross this runtime boundary.
// TypeScript types alone cannot guarantee that required numbers are present.
function normalizeAIWorkoutOutput<T extends WorkoutOutput>(output: T): T {
  function invalid(context: string): never {
    throw new AuthServiceError(`Dữ liệu AI không hợp lệ: ${context}. Vui lòng tạo lại chương trình.`, 422)
  }

  function positiveInteger(value: unknown, context: string, max = 2_147_483_647): number {
    const number = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value
    if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || number > max) {
      return invalid(context)
    }
    return number
  }

  if (!output || !Array.isArray(output.workouts) || output.workouts.length === 0) {
    return invalid("thiếu danh sách buổi tập")
  }

  return {
    ...output,
    workouts: output.workouts.map((workout, workoutIndex) => {
      if (!workout || !Array.isArray(workout.exercises) || workout.exercises.length === 0) {
        return invalid(`buổi ${workoutIndex + 1} thiếu bài tập`)
      }
      return {
        ...workout,
        exercises: workout.exercises.map((exercise, exerciseIndex) => {
          const context = `buổi ${workoutIndex + 1}, bài ${exerciseIndex + 1}`
          if (!exercise || typeof exercise !== "object") return invalid(context)
          const sets = positiveInteger(exercise.sets, `${context}: sets phải là số nguyên từ 1 đến 50`, 50)
          const repsMin = exercise.repsMin == null
            ? undefined
            : positiveInteger(exercise.repsMin, `${context}: repsMin phải là số nguyên dương`)
          // A legacy result may supply only the lower rep target. Preserve that
          // explicit target instead of inventing an unrelated default like 10.
          const reps = positiveInteger(exercise.reps ?? repsMin, `${context}: thiếu hoặc sai reps`)
          if (repsMin != null && repsMin > reps) return invalid(`${context}: repsMin lớn hơn reps`)
          return { ...exercise, sets, reps, repsMin }
        }),
      }
    }),
  }
}

export { normalizeAIWorkoutOutput }
