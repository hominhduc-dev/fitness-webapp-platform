import type { ReactNode } from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/auth/api"
import { useWeightEntries, useCreateWeightEntry, useProgressCalendar, useRecoveryHistory, useVolumeRecovery } from "./progress"
import { ACTIVE_SESSION_SEED_REUSE_MS, prefetchWorkouts, useWorkoutDetail, useWorkouts } from "./workouts"
import { prefetchMeals, useAddMealItem, useFoods, useNutritionDay } from "./meals"
import { useCoachLogs } from "./coach-logs"
import { prefetchCoachRoutes, useCoachData, useCoachNavCounts } from "./coach-data"
import { queryKeys } from "./keys"
import { userQueryKey } from "./scoped"
import { getQueryClient } from "./client"

const state = vi.hoisted(() => ({ userId: "user-a", token: "token-1" }))
const api = vi.hoisted(() => ({
  weights: vi.fn(), createWeight: vi.fn(), calendar: vi.fn(), workout: vi.fn(), workouts: vi.fn(),
  addMeal: vi.fn(), foods: vi.fn(), nutritionDay: vi.fn(), logs: vi.fn(),
  volume: vi.fn(), recovery: vi.fn(),
  navCounts: vi.fn(), trainees: vi.fn(), programs: vi.fn(), exercises: vi.fn(),
}))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { id: state.userId }, session: { access_token: state.token } }),
}))
vi.mock("./token", () => ({ requireAccessToken: async () => state.token }))
vi.mock("@/lib/fitness/api", async (original) => ({
  ...await original<typeof import("@/lib/fitness/api")>(),
  fetchWeightEntries: api.weights, createWeightEntry: api.createWeight,
  fetchProgressCalendar: api.calendar, fetchWorkoutDetail: api.workout,
  fetchWorkouts: api.workouts, addMealItem: api.addMeal, fetchFoods: api.foods,
  fetchNutritionDay: api.nutritionDay, fetchCoachWorkoutLogs: api.logs,
  fetchVolumeRecovery: api.volume, fetchRecoveryHistory: api.recovery,
  fetchCoachNavCounts: api.navCounts, fetchCoachTrainees: api.trainees,
  fetchCoachPrograms: api.programs, fetchCoachExercises: api.exercises,
}))

function setup() {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity, staleTime: 30_000 }, mutations: { retry: false },
  } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

beforeEach(() => { vi.clearAllMocks(); state.userId = "user-a"; state.token = "token-1" })

describe("client cache contracts", () => {
  it("uses the SSR seed and reuses it across provider remounts without a request", () => {
    const { client, wrapper } = setup()
    const seed: Awaited<ReturnType<typeof import("@/lib/fitness/api").fetchWeightEntries>> = []
    const first = renderHook(() => useWeightEntries(30, { initialData: seed }), { wrapper })
    expect(first.result.current.data).toBe(seed)
    first.unmount()
    const second = renderHook(() => useWeightEntries(30), { wrapper })
    expect(second.result.current.data).toBe(seed)
    expect(api.weights).not.toHaveBeenCalled()
    second.unmount(); client.clear()
  })

  it("reuses trainee route prefetch data without duplicate page requests", async () => {
    const { client, wrapper } = setup()
    const collection = { historyLogs: [], programs: [], recentLogs: [], schedule: {}, scheduleEntries: [], weekLogs: [], workouts: [] }
    const day = {
      date: new Date("2026-09-15T00:00:00"), meals: [], recentFoods: [],
      targets: { calories: 2_000, carbs: 250, fat: 67, protein: 150 },
      totals: { calories: 0, carbs: 0, fat: 0, protein: 0 },
    }
    api.workouts.mockResolvedValue(collection)
    api.foods.mockResolvedValue([])
    api.nutritionDay.mockResolvedValue(day)

    await prefetchWorkouts(client, state.userId)
    await prefetchMeals(client, state.userId, "2026-09-15")

    const hook = renderHook(() => ({
      workouts: useWorkouts(),
      day: useNutritionDay("2026-09-15"),
      foods: useFoods(),
    }), { wrapper })

    expect(hook.result.current.workouts.data).toBe(collection)
    expect(hook.result.current.day.data).toBe(day)
    expect(hook.result.current.foods.data).toEqual([])
    expect(api.workouts).toHaveBeenCalledTimes(1)
    expect(api.nutritionDay).toHaveBeenCalledTimes(1)
    expect(api.foods).toHaveBeenCalledTimes(1)
    hook.unmount(); client.clear()
  })

  it("reuses coach route prefetch data on the Clients, Programs, Exercises and Stats pages", async () => {
    const { client, wrapper } = setup()
    const counts = { programs: 3, trainees: 5 }
    api.navCounts.mockResolvedValue(counts)
    api.trainees.mockResolvedValue([])
    api.programs.mockResolvedValue([])
    api.exercises.mockResolvedValue([])

    await prefetchCoachRoutes(client, state.userId)

    // The same calls the pages and the sidebar make.
    const { fetchCoachExercises, fetchCoachPrograms, fetchCoachTrainees } = await import("@/lib/fitness/api")
    const hook = renderHook(() => ({
      counts: useCoachNavCounts(),
      trainees: useCoachData(queryKeys.coach.trainees(), fetchCoachTrainees),
      programs: useCoachData(queryKeys.coach.programs({ includeArchived: false }), (token) => fetchCoachPrograms(token, { includeArchived: false })),
      exercises: useCoachData(queryKeys.coach.exercises(), fetchCoachExercises),
    }), { wrapper })

    expect(hook.result.current.counts.data).toBe(counts)
    for (const query of [hook.result.current.trainees, hook.result.current.programs, hook.result.current.exercises]) {
      expect(query.isPending).toBe(false)
      expect(query.data).toEqual([])
    }
    for (const read of [api.navCounts, api.trainees, api.programs, api.exercises]) expect(read).toHaveBeenCalledTimes(1)
    expect(api.programs).toHaveBeenCalledWith(state.token, { includeArchived: false })
    hook.unmount(); client.clear()
  })

  it("does not reuse a previous account's seed on account change", async () => {
    const { client, wrapper } = setup()
    api.weights.mockResolvedValue([])
    const seed = [{ id: "old", recordedAt: new Date(), createdAt: new Date(), weightKg: 70 }]
    const hook = renderHook(() => useWeightEntries(30, { initialData: seed }), { wrapper })
    state.userId = "user-b"
    hook.rerender()
    expect(hook.result.current.data).toBeUndefined()
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
    expect(hook.result.current.data).toEqual([])
    expect(client.getQueryData(userQueryKey(queryKeys.progress.weightEntries(30), "user-a"))).toEqual(seed)
    hook.unmount(); client.clear()
  })

  it("resolves the refreshed token without changing the key", async () => {
    const { client, wrapper } = setup()
    api.weights.mockResolvedValue([])
    const hook = renderHook(() => useWeightEntries(30, { initialData: [] }), { wrapper })
    state.token = "token-2"
    await act(async () => { await hook.result.current.refetch() })
    expect(api.weights).toHaveBeenCalledWith("token-2", 30)
    expect(client.getQueryCache().getAll()).toHaveLength(1)
    hook.unmount(); client.clear()
  })

  it("invalidates every weight range and current profile after a successful write", async () => {
    const { client, wrapper } = setup()
    const keys = [queryKeys.progress.weightEntries(30), queryKeys.progress.weightEntries(365), queryKeys.profile.current()]
      .map((key) => userQueryKey(key, state.userId))
    keys.forEach((key) => client.setQueryData(key, []))
    api.createWeight.mockResolvedValue({ id: "new", recordedAt: new Date(), weightKg: 71 })
    const hook = renderHook(() => useCreateWeightEntry(), { wrapper })
    await act(async () => { await hook.result.current.mutateAsync({ weightKg: 71, recordedAt: new Date().toISOString() }) })
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true))
    hook.unmount(); client.clear()
  })

  it("applies a server seed to a query that a passive observer created first", () => {
    const { client, wrapper } = setup()
    const seed = { checkIn: null } as unknown as Awaited<ReturnType<typeof import("@/lib/fitness/api").fetchVolumeRecovery>>
    const passive = renderHook(() => useVolumeRecovery({ enabled: false }), { wrapper })
    expect(passive.result.current.data).toBeUndefined()
    const seeded = renderHook(() => useVolumeRecovery({ initialData: seed }), { wrapper })
    expect(seeded.result.current.data).toBe(seed)
    expect(api.volume).not.toHaveBeenCalled()
    passive.unmount(); seeded.unmount(); client.clear()
  })

  it("seeds without fetching when the seeding observer is disabled", () => {
    const { client, wrapper } = setup()
    const seed = { entries: [] } as unknown as Awaited<ReturnType<typeof import("@/lib/fitness/api").fetchRecoveryHistory>>
    renderHook(() => useRecoveryHistory(7, { enabled: false, initialData: seed }), { wrapper })
    const reader = renderHook(() => useRecoveryHistory(7), { wrapper })
    expect(reader.result.current.data).toBe(seed)
    expect(api.recovery).not.toHaveBeenCalled()
    reader.unmount(); client.clear()
  })

  it("treats a failed server seed as missing data and fetches it", async () => {
    const { client, wrapper } = setup()
    api.calendar.mockResolvedValue({ year: 2026, month: 9, days: [] })
    const hook = renderHook(() => useProgressCalendar(2026, 9, { initialData: null }), { wrapper })
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
    expect(api.calendar).toHaveBeenCalledTimes(1)
    hook.unmount(); client.clear()
  })

  it("refetches an active session seed restored from storage before reusing it", async () => {
    const { client, wrapper } = setup()
    const restored = { id: "w1", exercises: [], name: "Restored" } as unknown as import("@/lib/types").Workout
    const fresh = { id: "w1", exercises: [], name: "Fresh" } as unknown as import("@/lib/types").Workout
    client.setQueryData(userQueryKey(queryKeys.workouts.detail("w1"), state.userId), restored, {
      updatedAt: Date.now() - ACTIVE_SESSION_SEED_REUSE_MS - 1,
    })
    api.workout.mockResolvedValue(fresh)

    const hook = renderHook(() => useWorkoutDetail("w1", { activeSession: true }), { wrapper })

    await waitFor(() => expect(hook.result.current.data).toEqual(fresh))
    expect(api.workout).toHaveBeenCalledTimes(1)
    hook.unmount(); client.clear()
  })

  it("does not refetch an active session on invalidation or provider remount", async () => {
    const { client, wrapper } = setup()
    const seed = { id: "w1", exercises: [] } as unknown as import("@/lib/types").Workout
    const hook = renderHook(() => useWorkoutDetail("w1", { initialData: seed, activeSession: true }), { wrapper })
    await act(async () => { await client.invalidateQueries() })
    hook.unmount()
    const again = renderHook(() => useWorkoutDetail("w1", { activeSession: true }), { wrapper })
    expect(again.result.current.data).toEqual(seed)
    expect(api.workout).not.toHaveBeenCalled()
    again.unmount(); client.clear()
  })

  it("writes a completed meal mutation back to its original date after navigation", async () => {
    const { client, wrapper } = setup()
    const day = { meals: [], totals: { calories: 0 }, targets: {}, date: new Date(), recentFoods: [] }
    const firstKey = userQueryKey(queryKeys.meals.nutritionDay("2026-09-12"), state.userId)
    const secondKey = userQueryKey(queryKeys.meals.nutritionDay("2026-09-13"), state.userId)
    client.setQueryData(firstKey, day); client.setQueryData(secondKey, day)
    let finish!: (value: unknown) => void
    api.addMeal.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const hook = renderHook(({ date }) => useAddMealItem(date), { wrapper, initialProps: { date: "2026-09-12" } })
    let pending!: Promise<unknown>
    act(() => { pending = hook.result.current.mutateAsync({ foodId: "f1", date: "2026-09-12", mealType: "lunch", amountUnit: "serving", amountValue: 1 }) })
    await waitFor(() => expect(api.addMeal).toHaveBeenCalled())
    hook.rerender({ date: "2026-09-13" })
    await act(async () => { finish({ id: "m1", type: "lunch", calories: 120, protein: 10 }); await pending })
    expect(client.getQueryData<{ totals: { calories: number } }>(firstKey)?.totals.calories).toBe(120)
    expect(client.getQueryData(secondKey)).toEqual(day)
    hook.unmount(); client.clear()
  })

  it("follows the cursor once and keeps pages in a single infinite query", async () => {
    const { client, wrapper } = setup()
    api.logs.mockResolvedValueOnce({ logs: [{ id: "one" }], nextCursor: "next" }).mockResolvedValueOnce({ logs: [{ id: "two" }] })
    const hook = renderHook(() => useCoachLogs("trainee", "2026-09-07"), { wrapper })
    await waitFor(() => expect(hook.result.current.hasNextPage).toBe(true))
    await act(async () => { await hook.result.current.fetchNextPage() })
    expect(api.logs.mock.calls[1][2].cursor).toBe("next")
    await waitFor(() => expect(hook.result.current.data?.pages).toHaveLength(2))
    expect(hook.result.current.hasNextPage).toBe(false)
    hook.unmount(); client.clear()
  })

  it("uses a browser singleton and never retries client errors", () => {
    const client = getQueryClient()
    expect(getQueryClient()).toBe(client)
    const retry = client.getDefaultOptions().queries?.retry as (count: number, error: Error) => boolean
    for (const status of [400, 401, 403, 404, 429]) expect(retry(0, new ApiError("error", status))).toBe(false)
    expect(retry(1, new ApiError("error", 503))).toBe(true)
    expect(retry(2, new ApiError("error", 503))).toBe(false)
  })
})
