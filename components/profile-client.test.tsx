import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ToastProvider } from "@/components/providers/toast-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { renderWithProviders } from "@/lib/queries/test-utils"
import type { AppProfile, AppRole } from "@/lib/auth/types"

import { ProfileClient } from "./profile-client"

const authState = vi.hoisted(() => ({ profile: null as AppProfile | null }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    isLoading: false,
    profile: authState.profile,
    session: { access_token: "test-token" },
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    uploadAvatar: vi.fn(),
  }),
}))

vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")

  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

vi.mock("@/lib/queries/profile", () => ({ useResetTraineeData: () => ({ mutateAsync: vi.fn() }) }))
vi.mock("@/lib/queries/progress", () => ({
  useCreateWeightEntry: () => ({ mutateAsync: vi.fn() }),
  useWeightEntries: () => ({ data: [] }),
}))

function buildProfile(role: AppRole): AppProfile {
  return {
    avatar: null,
    dailyCalorieGoal: 2500,
    email: "person@example.invalid",
    fitnessGoals: ["Build Muscle"],
    id: "user-1",
    name: "Test Person",
    phone: null,
    preferredWeightUnit: "kg",
    role,
    username: "testperson",
  } as AppProfile
}

function renderSettings(role: AppRole) {
  authState.profile = buildProfile(role)

  return renderWithProviders(
    <ThemeProvider>
      <ToastProvider>
        <ProfileClient initialData={{ profile: buildProfile(role), weightEntries: [] }} />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe("Settings page layout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it("gives a trainee the compact profile card and every role-appropriate section", () => {
    renderSettings("trainee")

    for (const heading of ["Test Person", "Units & Measurements", "Body & Nutrition", "Fitness Goals", "Notifications", "Security"]) {
      expect(screen.getByRole("heading", { name: new RegExp(heading) })).toBeInTheDocument()
    }

    expect(screen.getByRole("button", { name: /Body & Nutrition/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("Build Muscle")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Reset Trainee Data/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByLabelText("Confirmation")).not.toBeInTheDocument()
  })

  it.each(["coach", "admin"] as const)("drops the trainee-only sections for a %s", (role) => {
    renderSettings(role)

    expect(screen.getByRole("heading", { name: /Test Person/ })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Body & Nutrition" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Fitness Goals" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Reset Trainee Data/ })).not.toBeInTheDocument()
  })

  it("opens the profile editor from the profile card", async () => {
    const user = userEvent.setup()
    renderSettings("trainee")

    expect(screen.queryByLabelText("Full Name")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Test Person/ }))
    expect(screen.getByLabelText("Full Name")).toHaveValue("Test Person")
    expect(screen.getByLabelText("Username")).toHaveValue("testperson")
  })

  it("keeps a save action inside editable sections", async () => {
    const user = userEvent.setup()
    renderSettings("trainee")

    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Test Person/ }))
    expect(screen.getByRole("button", { name: /Save/ })).toBeEnabled()
  })
})
