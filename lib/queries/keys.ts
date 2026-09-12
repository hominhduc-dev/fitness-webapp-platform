import type { BodyMetricQueryOptions, ExerciseQueryOptions } from "@/lib/queries/types"

/**
 * Every query key in the app, in one place.
 *
 * Rules this file exists to enforce:
 *
 * - **No access token in a key.** Supabase rotates it roughly hourly; keying on
 *   it would evict the entire cache each time. Query functions resolve the token
 *   themselves via `lib/queries/token.ts`.
 * - **No user id in a key either.** Threading it through forty key functions
 *   invites one to be forgotten, which is exactly the leak it would be there to
 *   prevent. The cache is cleared wholesale when the signed-in user changes —
 *   see `resetQueryCacheForUser` in the auth provider.
 * - **Every domain exposes an `all` prefix** so a mutation can invalidate a whole
 *   family without listing each variant.
 *
 * Option objects are spread into the key rather than passed by reference, so two
 * callers building an equivalent object hit the same cache entry.
 */

/**
 * Mirrors `buildExerciseQuery` in lib/fitness/api.ts: trim strings, drop empty
 * ones. Without this, `{ search: "bench " }` and `{ search: "bench" }` build the
 * same request URL but two different cache entries — a silent double fetch.
 */
function normalizeExerciseOptions(options?: ExerciseQueryOptions) {
  return {
    activityType: options?.activityType ?? null,
    equipment: options?.equipment?.trim() || null,
    muscle: options?.muscle ?? null,
    muscleGroup: options?.muscleGroup?.trim() || null,
    search: options?.search?.trim() || null,
  }
}

function normalizeBodyMetricOptions(options?: number | BodyMetricQueryOptions) {
  if (typeof options === "number") {
    return { days: options, from: null, to: null }
  }

  return {
    days: options?.days ?? null,
    from: options?.from ?? null,
    to: options?.to ?? null,
  }
}

export const queryKeys = {
  profile: {
    all: ["profile"] as const,
    current: () => ["profile", "current"] as const,
  },

  workouts: {
    all: ["workouts"] as const,
    /** The `/api/workouts` collection: schedule, entries, logs, programs, stats. */
    collection: () => ["workouts", "collection"] as const,
    detail: (workoutId: string) => ["workouts", "detail", workoutId] as const,
    traineeProgram: (programId: string) => ["workouts", "trainee-program", programId] as const,
  },

  exercises: {
    all: ["exercises"] as const,
    list: (options?: ExerciseQueryOptions) =>
      ["exercises", "list", normalizeExerciseOptions(options)] as const,
    library: (options?: ExerciseQueryOptions) =>
      ["exercises", "library", normalizeExerciseOptions(options)] as const,
  },

  meals: {
    all: ["meals"] as const,
    nutritionDay: (dateKey: string) => ["meals", "nutrition-day", dateKey] as const,
    foods: (options?: { category?: string; query?: string }) =>
      [
        "meals",
        "foods",
        {
          // `fetchFoods` drops the "all" sentinel and empty queries server-side.
          category: options?.category && options.category !== "all" ? options.category : null,
          query: options?.query?.trim() || null,
        },
      ] as const,
  },

  progress: {
    all: ["progress"] as const,
    analytics: () => ["progress", "analytics"] as const,
    calendar: (year: number, month: number, options?: { summaryOnly?: boolean }) =>
      ["progress", "calendar", year, month, { summaryOnly: options?.summaryOnly ?? false }] as const,
    yearView: (year: number) => ["progress", "year-view", year] as const,
    weightEntries: (options?: number | BodyMetricQueryOptions) =>
      ["progress", "weight-entries", normalizeBodyMetricOptions(options)] as const,
    workoutLogDetail: (logId: string) => ["progress", "workout-log", logId] as const,
  },

  coach: {
    all: ["coach"] as const,
    dashboard: () => ["coach", "dashboard"] as const,
    navCounts: () => ["coach", "nav-counts"] as const,
    trainees: (options?: { phone?: string }) =>
      ["coach", "trainees", { phone: options?.phone ?? null }] as const,
    traineeDetail: (traineeId: string) => ["coach", "trainee-detail", traineeId] as const,
    programs: (options?: { includeArchived?: boolean }) =>
      ["coach", "programs", { includeArchived: options?.includeArchived ?? false }] as const,
    program: (programId: string) => ["coach", "program", programId] as const,
    /** Cursor-paginated; the cursor itself lives in `pageParam`, not the key. */
    workoutLogs: (traineeId: string, options?: { weekStart?: string; programId?: string; limit?: number }) =>
      [
        "coach",
        "workout-logs",
        traineeId,
        {
          limit: options?.limit ?? null,
          programId: options?.programId ?? null,
          weekStart: options?.weekStart ?? null,
        },
      ] as const,
    bodyMetrics: (traineeId: string, options?: BodyMetricQueryOptions) =>
      ["coach", "body-metrics", traineeId, normalizeBodyMetricOptions(options)] as const,
    exercises: (search?: string) => ["coach", "exercises", search ?? null] as const,
    exerciseImportRequests: () => ["coach", "exercise-import-requests"] as const,
    discover: () => ["coach", "discover"] as const,
    googleConnection: () => ["coach", "google-connection"] as const,
    notionTemplates: () => ["coach", "notion-templates"] as const,
  },

  admin: {
    all: ["admin"] as const,
    dashboard: () => ["admin", "dashboard"] as const,
    users: (options?: { query?: string; role?: string }) =>
      ["admin", "users", { query: options?.query ?? null, role: options?.role ?? null }] as const,
    userDetail: (userId: string) => ["admin", "user-detail", userId] as const,
    coachRequests: (options?: { status?: string }) =>
      ["admin", "coach-requests", { status: options?.status ?? null }] as const,
    connections: () => ["admin", "connections"] as const,
    programs: () => ["admin", "programs"] as const,
    exercises: () => ["admin", "exercises"] as const,
    exerciseImportRequests: () => ["admin", "exercise-import-requests"] as const,
    auditLogs: (options?: { limit?: number }) =>
      ["admin", "audit-logs", { limit: options?.limit ?? null }] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (limit?: number) => ["notifications", "list", limit ?? null] as const,
  },
} as const
