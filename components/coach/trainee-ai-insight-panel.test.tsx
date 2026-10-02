import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { CoachTraineeInsight } from "@/lib/fitness/api"
import { renderWithProviders } from "@/lib/queries/test-utils"

import { TraineeAIInsightPanel } from "./trainee-ai-insight-panel"

const api = vi.hoisted(() => ({
  create: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock("@/lib/fitness/api", () => ({
  createCoachTraineeInsight: api.create,
  fetchCoachTraineeInsight: api.fetch,
}))

vi.mock("@/lib/queries/token", () => ({ requireAccessToken: async () => "token" }))

vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")
  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

const period = (overrides: Partial<CoachTraineeInsight["findings"]["current"]["training"]> = {}) => ({
  end: "2026-09-28",
  nutrition: { avgCalories: 2400, avgProtein: 140, caloriePct: 96, loggedDays: 12, proteinPct: 93 },
  recovery: { avgFatigue: 2, avgReadiness: 72, avgSleepHours: 7.2, avgStress: 35, checkIns: 10 },
  start: "2026-09-15",
  training: { adherencePct: 83, completed: 5, extraSessions: 1, planned: 6, setsCompleted: 80, setsTotal: 84, volumeKg: 21000, ...overrides },
  wearable: { avgRestingHeartRate: null, avgSteps: null, days: 0 },
  weight: { change: -0.6, entries: 4, first: 80.1, last: 79.5 },
})

const insight: CoachTraineeInsight = {
  days: 14,
  findings: {
    current: period(),
    days: 14,
    goals: { calories: 2500, protein: 150, targetWeightKg: 75 },
    lifts: [{ best: { e1rm: 122.5, reps: 5, weight: 105 }, changePct: 4.3, name: "Back Squat", previousBest: null, sets: 12 }],
    previous: period({ adherencePct: 67 }),
    toTargetKg: -4.5,
  },
  generatedAt: "2026-09-28T08:00:00.000Z",
  id: "gen-1",
  programNames: ["Upper/Lower"],
  sections: [{ area: "training", text: "Did 5 of 6 sessions.", tone: "good" }],
  stale: false,
  suggestions: ["Keep the volume next week."],
  summary: "A steady fortnight.",
}

beforeEach(() => {
  api.create.mockReset()
  api.fetch.mockReset()
})

afterEach(cleanup)

describe("TraineeAIInsightPanel", () => {
  it("shows the saved 14-day report with its computed figures without calling the AI", async () => {
    api.fetch.mockResolvedValue(insight)
    renderWithProviders(<TraineeAIInsightPanel traineeId="t-1" />)

    expect(await screen.findByText("A steady fortnight.")).toBeInTheDocument()
    expect(api.fetch).toHaveBeenCalledWith("token", "t-1", 14)
    expect(screen.getByText("83%")).toBeInTheDocument()
    expect(screen.getByText("+16%")).toBeInTheDocument()
    expect(screen.getByText("5/6 sessions")).toBeInTheDocument()
    expect(screen.getByText("-4.5 kg to target")).toBeInTheDocument()
    expect(screen.getByText("+4.3% e1RM")).toBeInTheDocument()
    expect(screen.getByText("Keep the volume next week.")).toBeInTheDocument()
    expect(api.create).not.toHaveBeenCalled()
  })

  it("asks for a new report for the chosen window", async () => {
    api.fetch.mockResolvedValue(null)
    api.create.mockResolvedValue({ ...insight, days: 7, summary: "One good week." })
    const user = userEvent.setup()
    renderWithProviders(<TraineeAIInsightPanel traineeId="t-1" />)

    await user.click(screen.getByRole("radio", { name: "7 days" }))
    await waitFor(() => expect(api.fetch).toHaveBeenCalledWith("token", "t-1", 7))
    await user.click(await screen.findByRole("button", { name: "Analyze" }))

    expect(await screen.findByText("One good week.")).toBeInTheDocument()
    expect(api.create).toHaveBeenCalledWith("token", "t-1", { days: 7, locale: "en" })
  })

  it("shows why an analysis failed", async () => {
    api.fetch.mockResolvedValue(null)
    api.create.mockRejectedValue(new Error("No data in the last 14 days."))
    const user = userEvent.setup()
    renderWithProviders(<TraineeAIInsightPanel traineeId="t-1" />)

    await user.click(await screen.findByRole("button", { name: "Analyze" }))
    expect(await screen.findByText("No data in the last 14 days.")).toBeInTheDocument()
  })
})
