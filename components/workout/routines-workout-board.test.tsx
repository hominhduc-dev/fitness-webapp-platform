import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { RoutinesWorkoutBoard } from "./routines-workout-board"
import { messages } from "@/lib/i18n/messages"
import type { TraineeProgram, WorkoutCollection } from "@/lib/fitness/types"

const query = vi.hoisted(() => ({ data: null as WorkoutCollection | null }))

vi.mock("@/lib/queries/workouts", () => ({
  useWorkouts: () => ({ data: query.data, isError: false, isPending: false, refetch: vi.fn() }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "en", messages: messages.en, setLocale: vi.fn() }),
}))
vi.mock("@/components/workout/routine-builder-dialog", () => ({ RoutineBuilderDialog: () => null }))

const coachProgram: TraineeProgram = {
  assignedAt: new Date("2026-09-10T00:00:00.000Z"),
  duration: 1,
  id: "program-1",
  isPersonal: false,
  name: "Program template — Coach Duc",
  startDate: "2126-09-21",
}

function renderBoard(collection: Partial<WorkoutCollection>) {
  query.data = {
    historyLogs: [],
    programs: [],
    recentLogs: [],
    schedule: {},
    scheduleEntries: [],
    todayWorkout: null,
    weekLogs: [],
    weekStats: { activeDaysThisWeek: 0, todayVolume: 0, workoutsThisWeek: 0 },
    workouts: [],
    ...collection,
  } as WorkoutCollection

  render(<RoutinesWorkoutBoard />)
}

afterEach(cleanup)

describe("RoutinesWorkoutBoard", () => {
  it("still shows an assigned program that serves no session this week", () => {
    // The coach pinned a start date in the future, so the server ships no
    // sessions for it yet. Without a card the trainee has no sign it exists.
    renderBoard({ programs: [coachProgram] })

    expect(screen.getByRole("heading", { name: coachProgram.name })).toBeInTheDocument()
    expect(screen.getByText("0 sessions this week")).toBeInTheDocument()
  })

  it("says when the program starts rather than calling it week 1", () => {
    renderBoard({ programs: [coachProgram] })

    expect(screen.getByText(/^Starts /)).toBeInTheDocument()
    expect(screen.queryByText(/Week 1 of/)).not.toBeInTheDocument()
  })

  it("leaves a trainee's own routines out of the program cards", () => {
    renderBoard({
      programs: [
        { ...coachProgram, id: "personal-1", isPersonal: true, isStandaloneRoutine: true, name: "My routine" },
      ],
    })

    expect(screen.queryByRole("heading", { name: "My routine" })).not.toBeInTheDocument()
  })

  it("gives a program the trainee authored a card of its own", () => {
    // An accepted AI plan is written by the trainee like a routine is, but it is
    // a real program: it used to scatter into loose cards on that likeness
    // alone.
    renderBoard({
      programs: [
        {
          ...coachProgram,
          duration: 4,
          id: "ai-1",
          isPersonal: true,
          isStandaloneRoutine: false,
          name: "My AI program",
        },
      ],
    })

    expect(screen.getByRole("heading", { name: "My AI program" })).toBeInTheDocument()
  })
})
