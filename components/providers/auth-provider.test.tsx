import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { Session, AuthChangeEvent } from "@supabase/supabase-js"
import { beforeEach, expect, it, vi } from "vitest"
import type { AppProfile } from "@/lib/auth/types"
import { AuthProvider, useAuth } from "./auth-provider"

const state = vi.hoisted(() => ({
  callback: undefined as undefined | ((event: AuthChangeEvent, session: Session | null) => void),
  session: null as Session | null,
  read: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({ getOptionalBrowserSupabaseClient: () => ({
  auth: {
    getSession: async () => ({ data: { session: state.session } }),
    onAuthStateChange: (callback: typeof state.callback) => {
      state.callback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    },
    signOut: state.signOut,
  },
}) }))
vi.mock("@/lib/auth/api", async (original) => ({ ...await original<typeof import("@/lib/auth/api")>(), fetchCurrentProfile: state.read }))

const profile = { id: "profile-a", supabaseAuthUserId: "auth-a", name: "A" } as AppProfile
const session = (id: string, token = "token") => ({ user: { id }, access_token: token }) as Session

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><AuthProvider initialProfile={profile}>{children}</AuthProvider></QueryClientProvider>
  return { client, ...renderHook(() => useAuth(), { wrapper }) }
}

beforeEach(() => { vi.clearAllMocks(); state.session = session("auth-a"); state.callback = undefined })

it("does not reuse an old bootstrap snapshot on repeated sign in", async () => {
  const hook = setup()
  await waitFor(() => expect(hook.result.current.session).not.toBeNull())
  hook.client.setQueryData(["profile", "bootstrap", "auth-a"], { ...profile, name: "Old" })
  state.read.mockResolvedValueOnce({ ...profile, name: "Updated" })
  act(() => { state.callback?.("SIGNED_IN", state.session) })
  await waitFor(() => expect(hook.result.current.profile?.name).toBe("Updated"))
  expect(state.read).toHaveBeenCalledTimes(1)
  hook.unmount(); hook.client.clear()
})

it("keeps seeded profile cache when only the access token refreshes", async () => {
  const hook = setup()
  await waitFor(() => expect(hook.result.current.session?.user.id).toBe("auth-a"))
  hook.client.setQueryData(["workouts", "sentinel"], "keep")
  act(() => { state.session = session("auth-a", "new-token"); state.callback?.("TOKEN_REFRESHED", state.session) })
  expect(hook.result.current.profile?.id).toBe("profile-a")
  expect(hook.client.getQueryData(["workouts", "sentinel"])).toBe("keep")
  expect(state.read).not.toHaveBeenCalled()
  hook.unmount(); hook.client.clear()
})

it("clears private rows and visible profile on sign out", async () => {
  const hook = setup()
  await waitFor(() => expect(hook.result.current.session).not.toBeNull())
  hook.client.setQueryData(["workouts", "private"], "old")
  await act(async () => { await hook.result.current.signOut() })
  expect(hook.client.getQueryData(["workouts", "private"])).toBeUndefined()
  expect(hook.result.current.profile).toBeNull()
  expect(state.signOut).toHaveBeenCalledWith({ scope: "local" })
  hook.unmount(); hook.client.clear()
})

it("does not restore an old in-flight profile response after a second account change", async () => {
  const hook = setup()
  await waitFor(() => expect(hook.result.current.session).not.toBeNull())
  let finish!: (value: AppProfile) => void
  state.read.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    .mockResolvedValueOnce({ ...profile, id: "profile-c", supabaseAuthUserId: "auth-c" })
  act(() => { state.session = session("auth-b"); state.callback?.("SIGNED_IN", state.session) })
  await waitFor(() => expect(state.read).toHaveBeenCalledTimes(1))
  act(() => { state.session = session("auth-c"); state.callback?.("SIGNED_IN", state.session) })
  await waitFor(() => expect(hook.result.current.profile?.id).toBe("profile-c"))
  await act(async () => { finish({ ...profile, id: "profile-b", supabaseAuthUserId: "auth-b" }) })
  expect(hook.result.current.profile?.id).toBe("profile-c")
  hook.unmount(); hook.client.clear()
})
