"use client"

import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { usePathname } from "next/navigation"
import { useEffect, useMemo } from "react"

import type { AppRole } from "@/lib/auth/types"

type TourStep = { body: string; target?: string; title: string }
const WELCOME_KEY = "yb_product_tour_welcome_v1"
const CONTEXT_KEY_PREFIX = "yb_product_tour_context_v1:"

const welcomeSteps: Record<AppRole, TourStep[]> = {
  trainee: [
    { title: "Your home base", body: "Dashboard brings together today's workout, nutrition, recovery and recent activity.", target: "[data-tour='dashboard-overview']" },
    { title: "Train with confidence", body: "Start a workout, log every set and keep your progress grounded in real data.", target: "[data-tour='dashboard-workout']" },
    { title: "Keep an eye on recovery", body: "Use progress and volume insights to see how your training is building up over time.", target: "[data-tour='dashboard-progress']" },
    { title: "Make it yours", body: "You can revisit settings, goals and connected coach features whenever you need them.", target: "[data-tour='dashboard-actions']" },
  ], coach: [], admin: [],
}

const contextualTours: Array<{ match: (pathname: string) => boolean; key: string; roles: AppRole[]; steps: TourStep[] }> = [
  { key: "coach-programs", roles: ["coach"], match: (p) => p === "/coach/programs" || p === "/coach/programs/", steps: [
    { title: "Program library", body: "Create, import and maintain reusable program templates here.", target: "[data-tour='coach-program-library']" },
    { title: "By client", body: "Switch to By client to see only assigned programs grouped under each trainee.", target: "[data-tour='coach-program-tabs']" },
    { title: "Assign with intent", body: "Open a program to review it, adjust a personalized copy or assign it to a client.", target: "[data-tour='coach-program-actions']" },
  ] },
  { key: "coach-client-detail", roles: ["coach"], match: (p) => /^\/coach\/trainees\/[^/]+$/.test(p), steps: [
    { title: "Client snapshot", body: "Overview gives you a quick read on training consistency, body metrics and recent sessions.", target: "[data-tour='coach-client-overview']" },
    { title: "Nutrition and logs", body: "Use Nutrition and Workout logs to inspect the details behind the weekly picture.", target: "[data-tour='coach-client-tabs']" },
    { title: "Coach actions", body: "Assign programs, add check-ins and keep the client's next action close at hand.", target: "[data-tour='coach-client-actions']" },
  ] },
  { key: "coach-workout-builder", roles: ["coach"], match: (p) => p === "/coach/programs/new" || /^\/coach\/programs\/[^/]+$/.test(p), steps: [
    { title: "Build the week", body: "Add workouts to each week and place them on the days your client will train.", target: "[data-tour='coach-workout-builder']" },
    { title: "Prescribe clearly", body: "Choose exercises, sets, reps, rest and intensity so the plan is ready to execute.", target: "[data-tour='coach-workout-exercises']" },
    { title: "Save, then assign", body: "Save the program when it is ready, then assign it from the program library or client detail.", target: "[data-tour='coach-workout-save']" },
  ] },
  { key: "trainee-workout", roles: ["trainee"], match: (p) => p === "/workout" || p.startsWith("/workout/"), steps: [
    { title: "Your training plan", body: "Find today's session and the rest of your assigned workouts in one place.", target: "[data-tour='trainee-workout-today']" },
    { title: "Log every set", body: "Start a workout, record reps and weight, and keep the plan connected to your real performance.", target: "[data-tour='trainee-workout-list']" },
    { title: "Adapt when needed", body: "You can replace an exercise during a session and keep the rest of your workout moving.", target: "[data-tour='trainee-workout-actions']" },
  ] },
  { key: "trainee-nutrition", roles: ["trainee"], match: (p) => p === "/meals" || p.startsWith("/meals/"), steps: [
    { title: "Plan your day", body: "See planned meals and your daily calorie and macro targets at a glance.", target: "[data-tour='trainee-nutrition-summary']" },
    { title: "Log what you eat", body: "Record meals and portions so your nutrition summary reflects the real day.", target: "[data-tour='trainee-nutrition-log']" },
    { title: "Adjust with context", body: "Use the daily totals to make small, practical changes instead of chasing perfection.", target: "[data-tour='trainee-nutrition-actions']" },
  ] },
  { key: "trainee-progress", roles: ["trainee"], match: (p) => p === "/progress" || p.startsWith("/progress/"), steps: [
    { title: "See the trend", body: "Progress brings training, strength, body weight and consistency into one view.", target: "[data-tour='trainee-progress-overview']" },
    { title: "Read the signals", body: "Use volume and recovery metrics to understand whether your current workload is sustainable.", target: "[data-tour='trainee-progress-metrics']" },
    { title: "Make the next decision", body: "Look for trends over time before changing your plan after a single session.", target: "[data-tour='trainee-progress-actions']" },
  ] },
  { key: "trainee-schedule", roles: ["trainee"], match: (p) => p === "/schedule" || p.startsWith("/schedule/"), steps: [
    { title: "Your training calendar", body: "See upcoming workouts, rest days and completed sessions across the week.", target: "[data-tour='trainee-schedule-calendar']" },
    { title: "Plan around real life", body: "Use the schedule to understand what is next and keep your training rhythm realistic.", target: "[data-tour='trainee-schedule-week']" },
    { title: "Stay flexible", body: "A missed day is information, not failure. Return to the next useful session and keep going.", target: "[data-tour='trainee-schedule-actions']" },
  ] },
]

function readStorage(key: string) {
  try { return window.localStorage.getItem(key) === "done" } catch { return false }
}

function writeStorage(key: string) {
  try { window.localStorage.setItem(key, "done") } catch { /* Tour is optional. */ }
}

export function ContextualProductTour({ role }: { role: AppRole }) {
  const pathname = usePathname()
  const contextTour = useMemo(() => contextualTours.find((candidate) => candidate.match(pathname)) ?? null, [pathname])

  useEffect(() => {
    let cancelled = false
    let activeTour: ReturnType<typeof driver> | null = null
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return
      const welcomePending = role === "trainee" && window.localStorage.getItem("yb_onboarding_tour_pending") === "1"
      const selected = welcomePending && !readStorage(WELCOME_KEY)
        ? { key: WELCOME_KEY, steps: welcomeSteps[role] }
        : contextTour && contextTour.roles.includes(role) && !readStorage(`${CONTEXT_KEY_PREFIX}${contextTour.key}`)
          ? { key: `${CONTEXT_KEY_PREFIX}${contextTour.key}`, steps: contextTour.steps }
          : null
      if (!selected || selected.steps.length === 0) return
      const availableSteps = selected.steps.filter((step) => !step.target || document.querySelector(step.target))
      if (availableSteps.length === 0) return

      activeTour = driver({
        animate: true,
        allowClose: true,
        overlayOpacity: 0.62,
        smoothScroll: true,
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        popoverClass: "yb-tour-popover",
        steps: availableSteps.map((step) => ({
          element: step.target,
          popover: {
            title: step.title,
            description: step.body,
            side: "top",
            align: "center",
          },
        })),
        onDestroyed: () => {
          writeStorage(selected.key)
          if (selected.key === WELCOME_KEY) window.localStorage.removeItem("yb_onboarding_tour_pending")
        },
      })
      activeTour.drive()
    }))
    return () => { cancelled = true; cancelAnimationFrame(frame); activeTour?.destroy() }
  }, [contextTour, pathname, role])

  return null
}
