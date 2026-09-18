import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { OnboardingWizard } from "./onboarding-wizard"

const state = vi.hoisted(() => ({
  createWeightEntry: vi.fn(),
  profile: null as Record<string, unknown> | null,
  replace: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }) }))

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: state.profile }) }))

vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")

  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

vi.mock("@/lib/queries/profile", () => ({
  useUpdateProfile: () => ({ isPending: false, mutateAsync: state.updateProfile }),
}))

vi.mock("@/lib/queries/progress", () => ({
  useCreateWeightEntry: () => ({ isPending: false, mutateAsync: state.createWeightEntry }),
}))

beforeEach(() => {
  state.profile = null
  state.replace = vi.fn()
  state.updateProfile = vi.fn().mockResolvedValue(undefined)
  state.createWeightEntry = vi.fn().mockResolvedValue(undefined)
  document.cookie = "yb_onboarding_skipped=; path=/; max-age=0"
})

afterEach(cleanup)

/** Walks the six screens with the given answers, stopping before the final button. */
async function fillWizard(user: ReturnType<typeof userEvent.setup>, { weight = "72" } = {}) {
  render(<OnboardingWizard />)

  await user.click(screen.getByRole("button", { name: "Male" }))
  await user.type(screen.getByLabelText("When were you born?"), "1998-04-12")
  await user.click(screen.getByRole("button", { name: "Next" }))
  await user.type(screen.getByLabelText("How tall are you?"), "175")
  await user.click(screen.getByRole("button", { name: "Next" }))
  if (weight) await user.type(screen.getAllByLabelText("What's your current weight?")[1], weight)
  await user.click(screen.getByRole("button", { name: "Next" }))
  await user.click(screen.getByRole("button", { name: /Moderate/ }))
  await user.click(screen.getByRole("button", { name: "Build Muscle" }))
}

describe("OnboardingWizard", () => {
  it("saves every answer in one request and opens the generator with the chosen goal", async () => {
    const user = userEvent.setup()
    await fillWizard(user)

    await user.click(screen.getByRole("button", { name: "Build my program" }))

    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledOnce())
    expect(state.updateProfile).toHaveBeenCalledWith({
      activityLevel: "moderate",
      birthDate: "1998-04-12",
      fitnessGoals: ["Build Muscle"],
      heightCm: 175,
      preferredWeightUnit: "kg",
      sex: "male",
    })
    expect(state.createWeightEntry).toHaveBeenCalledWith({ weightKg: 72 })
    expect(state.replace).toHaveBeenCalledWith("/workout/ai-generate?mode=program&goal=build_muscle")
  })

  it("converts a weight entered in pounds before storing it", async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)

    await user.click(screen.getByRole("button", { name: "Male" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "lbs" }))
    await user.type(screen.getAllByLabelText("What's your current weight?")[1], "154")
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: /Moderate/ }))
    await user.click(screen.getByRole("button", { name: "Build my program" }))

    await waitFor(() => expect(state.createWeightEntry).toHaveBeenCalledOnce())
    const [{ weightKg }] = state.createWeightEntry.mock.calls[0] as [{ weightKg: number }]
    expect(weightKg).toBeCloseTo(69.85, 1)
  })

  it("lets a blank answer through but blocks an out-of-range one", async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)

    await user.click(screen.getByRole("button", { name: "Male" }))
    // Nothing typed: the step is skippable.
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.type(screen.getByLabelText("How tall are you?"), "7")

    expect(screen.getByText("Enter a height between 50 and 300 cm.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("omits skipped fields from the saved profile", async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)

    await user.click(screen.getByRole("button", { name: "Female" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
    await user.click(screen.getByRole("button", { name: /Sedentary/ }))
    await user.click(screen.getByRole("button", { name: "Build my program" }))

    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledOnce())
    expect(state.updateProfile).toHaveBeenCalledWith({
      activityLevel: "sedentary",
      preferredWeightUnit: "kg",
      sex: "female",
    })
    expect(state.createWeightEntry).not.toHaveBeenCalled()
    expect(state.replace).toHaveBeenCalledWith("/workout/ai-generate?mode=program&goal=general_fitness")
  })

  it("records the dismissal in a cookie so the shell stops redirecting", async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)

    await user.click(screen.getByRole("button", { name: "Set this up later" }))

    expect(document.cookie).toContain("yb_onboarding_skipped=1")
    expect(state.replace).toHaveBeenCalledWith("/dashboard")
    expect(state.updateProfile).not.toHaveBeenCalled()
  })

  it("keeps the user on the last step when saving fails", async () => {
    state.updateProfile = vi.fn().mockRejectedValue(new Error("offline"))
    const user = userEvent.setup()
    await fillWizard(user)

    await user.click(screen.getByRole("button", { name: "Build my program" }))

    await waitFor(() => expect(screen.getByText("We could not save your profile. Please try again.")).toBeInTheDocument())
    expect(state.replace).not.toHaveBeenCalled()
  })
})
