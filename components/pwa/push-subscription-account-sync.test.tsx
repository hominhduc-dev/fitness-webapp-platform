import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  markNotificationRead: vi.fn(),
  syncCurrentPushSubscription: vi.fn(),
}))

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ session: { access_token: "access-token" } }),
}))
vi.mock("@/components/providers/locale-provider", () => ({
  useLocale: () => ({ locale: "vi" }),
}))
vi.mock("@/lib/fitness/api", () => ({ markNotificationRead: mocks.markNotificationRead }))
vi.mock("@/lib/push-notifications", () => ({ syncCurrentPushSubscription: mocks.syncCurrentPushSubscription }))

import { PushSubscriptionAccountSync } from "./push-subscription-account-sync"

const NOTIFICATION_ID = "00000000-0000-4000-8000-000000000001"

function renderSync() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PushSubscriptionAccountSync />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.markNotificationRead.mockResolvedValue({})
  mocks.syncCurrentPushSubscription.mockResolvedValue(true)
  window.history.replaceState({}, "", `/dashboard?pushNotification=${NOTIFICATION_ID}`)
})

describe("PushSubscriptionAccountSync", () => {
  it("marks an OS push as read and removes the lifecycle query parameter", async () => {
    renderSync()

    await waitFor(() => expect(mocks.markNotificationRead).toHaveBeenCalledWith("access-token", NOTIFICATION_ID))
    await waitFor(() => expect(window.location.search).toBe(""))
  })

  it("keeps the id in the URL when offline so it can retry later", async () => {
    mocks.markNotificationRead.mockRejectedValueOnce(new Error("offline"))
    renderSync()

    await waitFor(() => expect(mocks.markNotificationRead).toHaveBeenCalledOnce())
    expect(window.location.search).toContain(`pushNotification=${NOTIFICATION_ID}`)
  })
})
