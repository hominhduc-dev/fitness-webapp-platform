import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"

import { ToastProvider } from "@/components/providers/toast-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { renderWithProviders } from "@/lib/queries/test-utils"
import type { AppProfile, AppRole } from "@/lib/auth/types"

import { ProfileClient } from "./profile-client"

const authState = vi.hoisted(() => ({ profile: null as AppProfile | null }))

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    isLoading: false,
    profile: authState.profile,
    session: { access_token: "test-token" },
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

  it("gives a trainee every section, including the trainee-only ones", () => {
    renderSettings("trainee")

    for (const heading of ["Profile", "Preferences", "Body & Nutrition", "Fitness Goals", "Notifications", "Security"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
    }

    // The reset zone stays collapsed until its header is opened.
    expect(screen.getByRole("button", { name: /Reset Trainee Data/ })).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByLabelText("Confirmation")).not.toBeInTheDocument()
  })

  it.each(["coach", "admin"] as const)("drops the trainee-only sections for a %s", (role) => {
    renderSettings(role)

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Body & Nutrition" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Fitness Goals" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Reset Trainee Data/ })).not.toBeInTheDocument()
  })

  it("links every section from the jump navigation", () => {
    renderSettings("trainee")

    // Chips and rail render the same list, so each section has two links.
    const navigations = screen.getAllByRole("navigation", { name: "Settings sections" })
    expect(navigations).toHaveLength(2)
    expect(screen.getAllByRole("link", { name: "Security" })).toHaveLength(2)
    expect(document.getElementById("settings-security")).not.toBeNull()
  })

  it("keeps Save reachable from the sticky header", () => {
    renderSettings("trainee")

    expect(screen.getByRole("button", { name: /Save/ })).toBeEnabled()
  })
})
