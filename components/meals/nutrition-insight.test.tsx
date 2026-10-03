import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { NutritionInsight } from "@/lib/fitness/api"
import { renderWithProviders } from "@/lib/queries/test-utils"

import { NutritionInsightButton } from "./nutrition-insight"

const api = vi.hoisted(() => ({ create: vi.fn(), fetch: vi.fn(), locale: "vi" as "vi" | "en" }))

vi.mock("@/lib/fitness/api", () => ({
  createNutritionInsight: api.create,
  fetchNutritionInsight: api.fetch,
}))

vi.mock("@/lib/queries/token", () => ({ requireAccessToken: async () => "token" }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: { id: "user-1" } }) }))
vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")
  return { useLocale: () => ({ locale: api.locale, messages: getMessages(api.locale), setLocale: vi.fn() }) }
})

const insight: NutritionInsight = {
  date: "2026-10-02",
  generatedAt: "2026-10-02T08:00:00.000Z",
  locale: "vi",
  points: [{ text: "Protein đạt mục tiêu.", tone: "good" }],
  stale: false,
  suggestedFoods: [],
  summary: "Hôm nay ăn khá cân bằng.",
}

beforeEach(() => {
  api.create.mockReset()
  api.fetch.mockReset()
  api.locale = "vi"
})

afterEach(cleanup)

async function open() {
  const user = userEvent.setup()
  renderWithProviders(<NutritionInsightButton dateKey="2026-10-02" hasIntake onPickFood={vi.fn()} />)
  await user.click(screen.getByRole("button", { name: api.locale === "vi" ? "AI phân tích dinh dưỡng" : "AI Nutrition Insight" }))
  return user
}

describe("NutritionInsightButton", () => {
  it("reads the saved insight in the viewer's language", async () => {
    api.fetch.mockResolvedValue(insight)
    await open()

    expect(await screen.findByText("Hôm nay ăn khá cân bằng.")).toBeInTheDocument()
    expect(api.fetch).toHaveBeenCalledWith("token", "2026-10-02", "vi")
    expect(screen.queryByText(/đang bằng tiếng Anh/)).not.toBeInTheDocument()
  })

  it("offers to redo an insight written in the other language", async () => {
    api.locale = "en"
    api.fetch.mockResolvedValue(insight)
    api.create.mockResolvedValue({ ...insight, locale: "en", points: [{ text: "Protein is on target.", tone: "good" }], summary: "A balanced day." })
    const user = await open()

    expect(await screen.findByText(/This analysis is in Vietnamese/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Analyze again" }))

    expect(api.create).toHaveBeenCalledWith("token", { date: "2026-10-02", locale: "en" })
    expect(await screen.findByText("A balanced day.")).toBeInTheDocument()
    expect(screen.queryByText(/This analysis is in Vietnamese/)).not.toBeInTheDocument()
  })
})
