import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ResumeWorkoutCard } from "./resume-workout-card"

const mocks = vi.hoisted(() => ({ pathname: "/dashboard", clear: vi.fn(), queue: vi.fn().mockResolvedValue(undefined), push: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ profile: { id: "user-1" } }) }))
vi.mock("@/components/providers/locale-provider", () => ({ useLocale: () => ({ messages: { workoutPage: {
  resume: "Resume", discard: "Discard", inProgress: "In progress", workoutInProgress: "Workout",
  setsProgress: () => "1/3 sets", startedAgo: () => "started earlier", discardSessionTitle: "Discard workout?",
  discardSessionDescription: "Progress will be removed", keepSession: "Keep workout",
} } }) }))
vi.mock("@/lib/workout/use-active-workout-sessions", () => ({ useActiveWorkoutSessionList: () => ({ refresh: mocks.refresh, sessions: [{ workoutId: "workout-1", workoutName: "Upper", startedAt: "2026-11-07T00:00:00Z", completedSets: 1, totalSets: 3 }] }) }))
vi.mock("@/lib/workout/session-storage", () => ({ clearStoredWorkoutSession: mocks.clear }))
vi.mock("@/lib/offline/workout-log-queue", () => ({ queueWorkoutSessionDraftDelete: mocks.queue }))

let intersect: IntersectionObserverCallback
let observer: IntersectionObserver
const observe = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  mocks.pathname = "/dashboard"
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; observer = this as unknown as IntersectionObserver }
    observe = observe
    disconnect = vi.fn()
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("ResumeWorkoutCard", () => {
  it("keeps the session until discard is explicitly confirmed", () => {
    render(<ResumeWorkoutCard />)
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    expect(mocks.clear).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Keep workout" }))
    expect(mocks.clear).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Discard" }))
    expect(mocks.clear).toHaveBeenCalledWith("workout-1")
    expect(mocks.queue).toHaveBeenCalledWith("user-1", "workout-1")
  })

  it("observes a streamed matching CTA and restores the chip after scrolling away", async () => {
    const { container } = render(<ResumeWorkoutCard />)
    const inline = document.createElement("button")
    inline.dataset.workoutResumeId = "workout-1"
    await act(async () => { document.body.append(inline) })
    expect(observe).toHaveBeenCalledWith(inline)
    act(() => intersect([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], observer))
    expect(container.querySelector(".workout-floating-chip")).toHaveAttribute("hidden")
    act(() => intersect([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], observer))
    expect(container.querySelector(".workout-floating-chip")).not.toHaveAttribute("hidden")
    inline.remove()
  })

  it("keeps other routes unchanged and resumes through the router", () => {
    mocks.pathname = "/schedule"
    render(<ResumeWorkoutCard />)
    expect(observe).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(mocks.push).toHaveBeenCalledWith("/workout/workout-1/start", { scroll: true })
  })
})
