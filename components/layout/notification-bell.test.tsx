import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { AppNotification, NotificationList } from "@/lib/fitness/types"
import { renderWithProviders } from "@/lib/queries/test-utils"

import { NotificationBell } from "./notification-bell"

const state = vi.hoisted(() => ({
  list: { notifications: [], unreadCount: 0 } as NotificationList,
  markAll: vi.fn(),
  markRead: vi.fn(),
  push: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }))

vi.mock("@/components/providers/locale-provider", async () => {
  const { getMessages } = await vi.importActual<typeof import("@/lib/i18n/messages")>("@/lib/i18n/messages")

  return { useLocale: () => ({ locale: "en", messages: getMessages("en"), setLocale: vi.fn() }) }
})

vi.mock("@/lib/queries/notifications", () => ({
  useMarkAllNotificationsRead: () => ({ isPending: false, mutate: state.markAll }),
  useMarkNotificationRead: () => ({ mutate: state.markRead }),
  useNotifications: () => ({ data: state.list, isError: false, isPending: false }),
}))

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    createdAt: new Date(Date.now() - 5 * 60_000),
    id: "n1",
    message: "Stored",
    scheduledFor: new Date(),
    status: "sent",
    title: "Stored",
    type: "general",
    ...overrides,
  }
}

beforeEach(() => {
  state.markAll.mockReset()
  state.markRead.mockReset()
  state.push.mockReset()
})

afterEach(cleanup)

describe("NotificationBell", () => {
  it("shows the unread count and opens a notification's page, marking it read", async () => {
    state.list = {
      notifications: [
        notification({
          id: "review",
          metadata: { traineeCount: 3, trainees: [], url: "/coach/trainees", workoutTotal: 7 },
          type: "coach_weekly_review",
        }),
        notification({ id: "old", readAt: new Date(), type: "weight_reminder" }),
      ],
      unreadCount: 12,
    }
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />)

    const trigger = screen.getByRole("button", { name: "Notifications, 12 unread" })
    expect(trigger).toHaveTextContent("9+")

    await user.click(trigger)
    expect(await screen.findByText("Weekly trainee review")).toBeInTheDocument()
    expect(screen.getByText("Your 3 trainees logged 7 workouts this week. Review their progress.")).toBeInTheDocument()
    expect(screen.getByText("Time to log your weight")).toBeInTheDocument()

    await user.click(screen.getByText("Weekly trainee review"))
    expect(state.markRead).toHaveBeenCalledWith("review")
    expect(state.push).toHaveBeenCalledWith("/coach/trainees")
  })

  it("does not re-mark a read notification and offers mark-all only with unread items", async () => {
    state.list = { notifications: [notification({ id: "old", readAt: new Date(), type: "check_in_reminder" })], unreadCount: 0 }
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />)

    await user.click(screen.getByRole("button", { name: "Notifications" }))
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled()

    await user.click(await screen.findByText("Morning check-in"))
    expect(state.markRead).not.toHaveBeenCalled()
  })

  it("shows an empty state", async () => {
    state.list = { notifications: [], unreadCount: 0 }
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />)

    await user.click(screen.getByRole("button", { name: "Notifications" }))
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument()
  })
})
