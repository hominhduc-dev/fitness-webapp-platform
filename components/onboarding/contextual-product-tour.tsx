"use client"

import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import type { AppRole } from "@/lib/auth/types"
import { cn } from "@/lib/utils"

type TourStep = { body: string; target?: string; title: string }

const WELCOME_KEY = "yb_product_tour_welcome_v1"
const CONTEXT_KEY_PREFIX = "yb_product_tour_context_v1:"

const welcomeSteps: Record<AppRole, TourStep[]> = {
  trainee: [
    { title: "Your home base", body: "Dashboard brings together today's workout, nutrition, recovery and recent activity.", target: "[data-tour='dashboard-overview']" },
    { title: "Train with confidence", body: "Start a workout, log every set and keep your progress grounded in real data.", target: "[data-tour='dashboard-workout']" },
    { title: "Keep an eye on recovery", body: "Use progress and volume insights to see how your training is building up over time.", target: "[data-tour='dashboard-progress']" },
    { title: "Make it yours", body: "You can revisit settings, goals and connected coach features whenever you need them.", target: "[data-tour='dashboard-actions']" },
  ],
  coach: [],
  admin: [],
}

const contextualTours: Array<{ match: (pathname: string) => boolean; key: string; roles: AppRole[]; steps: TourStep[] }> = [
  {
    key: "coach-programs",
    roles: ["coach"],
    match: (pathname) => pathname === "/coach/programs" || pathname === "/coach/programs/",
    steps: [
      { title: "Program library", body: "Create, import and maintain reusable program templates here.", target: "[data-tour='coach-program-library']" },
      { title: "By client", body: "Switch to By client to see only assigned programs grouped under each trainee.", target: "[data-tour='coach-program-tabs']" },
      { title: "Assign with intent", body: "Open a program to review it, adjust a personalized copy or assign it to a client.", target: "[data-tour='coach-program-actions']" },
    ],
  },
  {
    key: "coach-client-detail",
    roles: ["coach"],
    match: (pathname) => /^\/coach\/trainees\/[^/]+$/.test(pathname),
    steps: [
      { title: "Client snapshot", body: "Overview gives you a quick read on training consistency, body metrics and recent sessions.", target: "[data-tour='coach-client-overview']" },
      { title: "Nutrition and logs", body: "Use Nutrition and Workout logs to inspect the details behind the weekly picture.", target: "[data-tour='coach-client-tabs']" },
      { title: "Coach actions", body: "Assign programs, add check-ins and keep the client's next action close at hand.", target: "[data-tour='coach-client-actions']" },
    ],
  },
  {
    key: "coach-workout-builder",
    roles: ["coach"],
    match: (pathname) => pathname === "/coach/programs/new" || /^\/coach\/programs\/[^/]+$/.test(pathname),
    steps: [
      { title: "Build the week", body: "Add workouts to each week and place them on the days your client will train.", target: "[data-tour='coach-workout-builder']" },
      { title: "Prescribe clearly", body: "Choose exercises, sets, reps, rest and intensity so the plan is ready to execute.", target: "[data-tour='coach-workout-exercises']" },
      { title: "Save, then assign", body: "Save the program when it is ready, then assign it from the program library or client detail.", target: "[data-tour='coach-workout-save']" },
    ],
  },
  {
    key: "trainee-workout",
    roles: ["trainee"],
    match: (pathname) => pathname === "/workout" || pathname.startsWith("/workout/"),
    steps: [
      { title: "Your training plan", body: "Find today's session and the rest of your assigned workouts in one place.", target: "[data-tour='trainee-workout-today']" },
      { title: "Log every set", body: "Start a workout, record reps and weight, and keep the plan connected to your real performance.", target: "[data-tour='trainee-workout-list']" },
      { title: "Adapt when needed", body: "You can replace an exercise during a session and keep the rest of your workout moving.", target: "[data-tour='trainee-workout-actions']" },
    ],
  },
  {
    key: "trainee-nutrition",
    roles: ["trainee"],
    match: (pathname) => pathname === "/meals" || pathname.startsWith("/meals/"),
    steps: [
      { title: "Plan your day", body: "See planned meals and your daily calorie and macro targets at a glance.", target: "[data-tour='trainee-nutrition-summary']" },
      { title: "Log what you eat", body: "Record meals and portions so your nutrition summary reflects the real day.", target: "[data-tour='trainee-nutrition-log']" },
      { title: "Adjust with context", body: "Use the daily totals to make small, practical changes instead of chasing perfection.", target: "[data-tour='trainee-nutrition-actions']" },
    ],
  },
  {
    key: "trainee-progress",
    roles: ["trainee"],
    match: (pathname) => pathname === "/progress" || pathname.startsWith("/progress/"),
    steps: [
      { title: "See the trend", body: "Progress brings training, strength, body weight and consistency into one view.", target: "[data-tour='trainee-progress-overview']" },
      { title: "Read the signals", body: "Use volume and recovery metrics to understand whether your current workload is sustainable.", target: "[data-tour='trainee-progress-metrics']" },
      { title: "Make the next decision", body: "Look for trends over time before changing your plan after a single session.", target: "[data-tour='trainee-progress-actions']" },
    ],
  },
  {
    key: "trainee-schedule",
    roles: ["trainee"],
    match: (pathname) => pathname === "/schedule" || pathname.startsWith("/schedule/"),
    steps: [
      { title: "Your training calendar", body: "See upcoming workouts, rest days and completed sessions across the week.", target: "[data-tour='trainee-schedule-calendar']" },
      { title: "Plan around real life", body: "Use the schedule to understand what is next and keep your training rhythm realistic.", target: "[data-tour='trainee-schedule-week']" },
      { title: "Stay flexible", body: "A missed day is information, not failure. Return to the next useful session and keep going.", target: "[data-tour='trainee-schedule-actions']" },
    ],
  },
]

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key) === "done"
  } catch {
    return false
  }
}

function writeStorage(key: string) {
  try {
    window.localStorage.setItem(key, "done")
  } catch {
    // A blocked localStorage should not prevent the user from using the app.
  }
}

export function ContextualProductTour({ role }: { role: AppRole }) {
  const pathname = usePathname()
  const [hydrated, setHydrated] = useState(false)
  const [tour, setTour] = useState<{ key: string; steps: TourStep[] } | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const contextTour = useMemo(
    () => contextualTours.find((candidate) => candidate.match(pathname)) ?? null,
    [pathname],
  )

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || tour) return

    const welcomePending = role === "trainee" && window.localStorage.getItem("yb_onboarding_tour_pending") === "1"
    if (welcomePending && !readStorage(WELCOME_KEY)) {
      setTour({ key: WELCOME_KEY, steps: welcomeSteps[role] })
      setStepIndex(0)
      return
    }

    if (contextTour && contextTour.roles.includes(role) && !readStorage(`${CONTEXT_KEY_PREFIX}${contextTour.key}`)) {
      setTour({ key: `${CONTEXT_KEY_PREFIX}${contextTour.key}`, steps: contextTour.steps })
      setStepIndex(0)
    }
  }, [contextTour, hydrated, role, tour])

  const currentTarget = tour?.steps[stepIndex]?.target
  useEffect(() => {
    if (!tour || !currentTarget) {
      setTargetRect(null)
      return
    }

    const element = document.querySelector<HTMLElement>(currentTarget)
    if (!element) {
      setTargetRect(null)
      return
    }

    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    const updateRect = () => setTargetRect(element.getBoundingClientRect())
    const frame = requestAnimationFrame(updateRect)
    window.addEventListener("resize", updateRect)
    window.addEventListener("scroll", updateRect, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
    }
  }, [currentTarget, stepIndex, tour])

  if (!tour) return null

  const current = tour.steps[stepIndex]
  const isLast = stepIndex === tour.steps.length - 1
  const finish = () => {
    writeStorage(tour.key)
    if (tour.key === WELCOME_KEY) window.localStorage.removeItem("yb_onboarding_tour_pending")
    setTour(null)
  }

  return (
    <>
      {targetRect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[79] rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] transition-[top,left,width,height] duration-300"
          style={{ top: Math.max(8, targetRect.top - 6), left: Math.max(8, targetRect.left - 6), width: targetRect.width + 12, height: targetRect.height + 12 }}
        />
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3 sm:bottom-5 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-card p-4 shadow-2xl ring-1 ring-primary/10 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-micro uppercase tracking-[0.08em] text-primary">{stepIndex + 1} / {tour.steps.length}</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{current.title}</h2>
          </div>
          <button type="button" aria-label="Skip tour" className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={finish}>
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {tour.steps.map((entry, index) => <span key={entry.title} className={cn("h-1.5 w-5 rounded-full bg-muted", index === stepIndex && "bg-primary")} />)}
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 ? <Button type="button" variant="ghost" size="sm" onClick={() => setStepIndex((index) => index - 1)}><ChevronLeft className="size-4" />Back</Button> : null}
            <Button type="button" size="sm" onClick={() => isLast ? finish() : setStepIndex((index) => index + 1)}>{isLast ? "Done" : "Next"}<ChevronRight className="size-4" /></Button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
