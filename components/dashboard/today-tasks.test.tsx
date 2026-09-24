import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { formatDateKey } from "@/lib/time-zone"

import { TodayTasks } from "./today-tasks"

const state = vi.hoisted(() => ({
  checkedInToday: true,
  entries: [] as Array<{ recordedAt: Date; weightKg: number | null }>,
  unit: "kg" as "kg" | "lbs",
  mutateAsync: vi.fn(),
}))

vi.mock("@/lib/queries/progress", () => ({
  useVolumeRecovery: () => ({
    data: { checkIn: state.checkedInToday ? { checkInDate: formatDateKey(new Date()) } : null, muscles: [] },
  }),
  useWeightEntries: () => ({ data: state.entries }),
  useCreateWeightEntry: () => ({ isPending: false, mutateAsync: state.mutateAsync }),
}))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ profile: { preferredWeightUnit: state.unit } }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({
    messages: {
      dashboard: {
        checkInTitle: "Daily check-in",
        checkInShort: "1 minute for today's plan",
        checkInAction: "Check in",
        weighInTitle: "Today's weight",
        weighInHint: "Weigh in once a day",
        weighInLast: (weight: string) => `Last: ${weight}`,
        weighInInputLabel: (unit: string) => `Weight in ${unit}`,
        weighInSave: "Save",
        weighInSaving: "Saving…",
        weighInError: "Couldn't save. Try again.",
      },
    },
  }),
}))
vi.mock("@/components/progress/volume-recovery/volume-recovery-panel", () => ({ CheckInSheet: () => null }))
vi.mock("./coach-insight", () => ({ CoachInsightCard: () => <p>Coach insight</p> }))

const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000)

beforeEach(() => {
  state.checkedInToday = true
  state.entries = []
  state.unit = "kg"
  state.mutateAsync = vi.fn().mockResolvedValue({})
})

afterEach(cleanup)

describe("TodayTasks", () => {
  it("walks one slot through check-in, then today's weight, then the coach insight", () => {
    state.checkedInToday = false
    state.entries = [{ recordedAt: yesterday(), weightKg: 72.4 }]
    const { rerender } = render(<TodayTasks />)
    expect(screen.getByText("Daily check-in")).toBeInTheDocument()
    expect(screen.queryByText("Today's weight")).not.toBeInTheDocument()

    state.checkedInToday = true
    rerender(<TodayTasks />)
    expect(screen.queryByText("Daily check-in")).not.toBeInTheDocument()
    expect(screen.getByText("Today's weight")).toBeInTheDocument()
    expect(screen.getByText("Last: 72.4 kg")).toBeInTheDocument()

    state.entries = [...state.entries, { recordedAt: new Date(), weightKg: 72.1 }]
    rerender(<TodayTasks />)
    expect(screen.queryByText("Today's weight")).not.toBeInTheDocument()
    expect(screen.getByText("Coach insight")).toBeInTheDocument()
  })

  it("saves in kilograms whatever unit the trainee types in", async () => {
    state.unit = "lbs"
    render(<TodayTasks />)
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Weight in lbs"), { target: { value: "160,5" } })
    fireEvent.click(save)

    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce())
    expect(state.mutateAsync.mock.calls[0][0].weightKg).toBeCloseTo(72.8, 1)
  })

  it("says so when saving fails", async () => {
    state.mutateAsync = vi.fn().mockRejectedValue(new Error("network"))
    render(<TodayTasks />)
    fireEvent.change(screen.getByLabelText("Weight in kg"), { target: { value: "70" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument()
  })
})
