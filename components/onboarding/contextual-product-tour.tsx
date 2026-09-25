"use client"

import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import type { AppRole } from "@/lib/auth/types"
import type { AppMessages } from "@/lib/i18n/messages"

/**
 * `activate` is a control to click before the step when its target is not on
 * screen — a tab, so one tour can walk through every tab of a page.
 */
type TourStep = { activate?: string; body: string; target?: string; title: string }
type TourMessages = AppMessages["onboarding"]["productTour"]
const WELCOME_KEY = "yb_product_tour_welcome_v1"
const CONTEXT_KEY_PREFIX = "yb_product_tour_context_v1:"
const DASHBOARD_TOUR_KEY = "trainee-dashboard"
/** /workout/{id}/start — the live logging screen, not the workout list. */
const SESSION_PATH = /^\/workout\/[^/]+\/start\/?$/
const TOUR_START_RETRY_MS = 80
// About 3s: long enough for a page's streamed content to hydrate on a slow phone.
const TOUR_START_MAX_ATTEMPTS = 40
// How long a step waits for its card after a tab switch before it is skipped.
const STEP_WAIT_MS = 3000

/**
 * React marks a DOM node it has hydrated with an internal `__reactFiber$…` key.
 * The tour lives in the shell layout, which hydrates before a page's streamed
 * content; decorating server HTML React has not claimed yet (driver.js adds a
 * class and aria attributes to the target) makes hydration report a mismatch.
 */
function isHydrated(element: Element) {
  return Object.keys(element).some((key) => key.startsWith("__reactFiber$"))
}

/** Top to bottom through Overview, History and Recovery, one card per step. */
function progressSteps(copy: TourMessages["traineeProgress"]): TourStep[] {
  const onTab = (tab: string, steps: Array<[keyof typeof copy, string]>) =>
    steps.map(([key, anchor]) => ({ ...copy[key], activate: `[data-tour-tab='${tab}']`, target: `[data-tour='${anchor}']` }))

  return [
    { ...copy.tabs, target: "[data-tour='progress-tabs']" },
    ...onTab("overview", [
      ["thisWeek", "progress-this-week"],
      ["body", "progress-body"],
      ["period", "progress-period"],
      ["periodSummary", "progress-period-summary"],
      ["frequency", "progress-frequency"],
      ["volume", "progress-volume"],
      ["muscles", "progress-muscles"],
      ["records", "progress-records"],
    ]),
    ...onTab("history", [
      ["historyPeriod", "progress-history-period"],
      ["historyFilters", "progress-history-filters"],
      ["historyStats", "progress-history-stats"],
      ["historyCalendar", "progress-history-calendar"],
      ["historyRecent", "progress-history-recent"],
      ["historyTrainedAreas", "progress-history-trained-areas"],
    ]),
    ...onTab("volume", [
      ["recoveryReadiness", "progress-recovery-readiness"],
      ["recoveryTrend", "progress-recovery-trend"],
      ["recoveryVolume", "progress-recovery-volume"],
    ]),
  ]
}

export function buildTours(copy: TourMessages) {
  const dashboardSteps: TourStep[] = [
    { ...copy.dashboard.checkIn, target: "[data-tour='dashboard-check-in']" },
    { ...copy.dashboard.quickActions, target: "[data-tour='dashboard-quick-actions']" },
    { ...copy.dashboard.readiness, target: "[data-tour='dashboard-readiness']" },
    { ...copy.dashboard.nutrition, target: "[data-tour='dashboard-nutrition']" },
    { ...copy.dashboard.todayWorkout, target: "[data-tour='dashboard-today-workout']" },
    { ...copy.dashboard.weeklyProgress, target: "[data-tour='dashboard-weekly-progress']" },
    { ...copy.dashboard.weeklyVolume, target: "[data-tour='dashboard-weekly-volume']" },
    { ...copy.dashboard.trainingMetrics, target: "[data-tour='dashboard-volume-info']" },
    { ...copy.dashboard.recentActivity, target: "[data-tour='dashboard-recent-activity']" },
  ]
  const welcomeSteps: Record<AppRole, TourStep[]> = { trainee: dashboardSteps, coach: [], admin: [] }
  const contextualTours: Array<{ match: (pathname: string) => boolean; key: string; roles: AppRole[]; steps: TourStep[] }> = [
    { key: DASHBOARD_TOUR_KEY, roles: ["trainee"], match: (p) => p === "/dashboard" || p === "/dashboard/", steps: welcomeSteps.trainee },
    { key: "coach-programs", roles: ["coach"], match: (p) => p === "/coach/programs" || p === "/coach/programs/", steps: [
      { ...copy.coachPrograms.library, target: "[data-tour='coach-program-library']" },
      { ...copy.coachPrograms.byClient, target: "[data-tour='coach-program-tabs']" },
      { ...copy.coachPrograms.actions, target: "[data-tour='coach-program-actions']" },
    ] },
    { key: "coach-client-detail", roles: ["coach"], match: (p) => /^\/coach\/trainees\/[^/]+$/.test(p), steps: [
      { ...copy.coachClientDetail.overview, target: "[data-tour='coach-client-overview']" },
      { ...copy.coachClientDetail.tabs, target: "[data-tour='coach-client-tabs']" },
      { ...copy.coachClientDetail.actions, target: "[data-tour='coach-client-actions']" },
    ] },
    { key: "coach-workout-builder", roles: ["coach"], match: (p) => p === "/coach/programs/new" || /^\/coach\/programs\/[^/]+$/.test(p), steps: [
      { ...copy.coachWorkoutBuilder.week, target: "[data-tour='coach-workout-builder']" },
      { ...copy.coachWorkoutBuilder.exercises, target: "[data-tour='coach-workout-exercises']" },
      { ...copy.coachWorkoutBuilder.save, target: "[data-tour='coach-workout-save']" },
    ] },
    // Ahead of "trainee-workout" on purpose: `find` takes the first match, and
    // that tour's `/workout/` prefix also covers this route while none of its
    // targets exist here. Left second, the session tour could never be picked.
    { key: "trainee-workout-session", roles: ["trainee"], match: (p) => SESSION_PATH.test(p), steps: [
      { ...copy.traineeWorkoutSession.stats, target: "[data-tour='session-stats']" },
      { ...copy.traineeWorkoutSession.exercise, target: "[data-tour='session-exercise']" },
      { ...copy.traineeWorkoutSession.set, target: "[data-tour='session-set']" },
      { ...copy.traineeWorkoutSession.finish, target: "[data-tour='session-finish']" },
    ] },
    { key: "trainee-workout", roles: ["trainee"], match: (p) => (p === "/workout" || p.startsWith("/workout/")) && !SESSION_PATH.test(p), steps: [
      { ...copy.traineeWorkout.today, target: "[data-tour='trainee-workout-today']" },
      { ...copy.traineeWorkout.list, target: "[data-tour='trainee-workout-list']" },
      { ...copy.traineeWorkout.actions, target: "[data-tour='trainee-workout-actions']" },
    ] },
    { key: "trainee-nutrition", roles: ["trainee"], match: (p) => p === "/meals" || p.startsWith("/meals/"), steps: [
      { ...copy.traineeNutrition.summary, target: "[data-tour='trainee-nutrition-summary']" },
      { ...copy.traineeNutrition.log, target: "[data-tour='trainee-nutrition-log']" },
      { ...copy.traineeNutrition.actions, target: "[data-tour='trainee-nutrition-actions']" },
    ] },
    // v2: the card-by-card walk through all three tabs replaced a three-step
    // intro, so trainees who finished the old one see the new one once.
    { key: "trainee-progress-v2", roles: ["trainee"], match: (p) => p === "/progress" || p.startsWith("/progress/"), steps: progressSteps(copy.traineeProgress) },
    { key: "trainee-schedule", roles: ["trainee"], match: (p) => p === "/schedule" || p.startsWith("/schedule/"), steps: [
      { ...copy.traineeSchedule.calendar, target: "[data-tour='trainee-schedule-calendar']" },
      { ...copy.traineeSchedule.week, target: "[data-tour='trainee-schedule-week']" },
      { ...copy.traineeSchedule.actions, target: "[data-tour='trainee-schedule-actions']" },
    ] },
  ]

  return { contextualTours, welcomeSteps }
}

function readStorage(key: string) {
  try { return window.localStorage.getItem(key) === "done" } catch { return false }
}

function writeStorage(key: string) {
  try { window.localStorage.setItem(key, "done") } catch { /* Tour is optional. */ }
}

function scrollTargetIntoView(target: HTMLElement) {
  const targetRect = target.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const safeTop = 96
  const safeBottom = 132
  const targetCenter = targetRect.top + targetRect.height / 2
  const desiredCenter = safeTop + (viewportHeight - safeTop - safeBottom) / 2
  const isComfortablyVisible = targetRect.top >= safeTop && targetRect.bottom <= viewportHeight - safeBottom
  // A card taller than the free space is read from its top, not its middle.
  const isTall = targetRect.height > viewportHeight - safeTop - safeBottom

  if (!isComfortablyVisible) {
    window.scrollBy({
      top: isTall ? targetRect.top - safeTop : targetCenter - desiredCenter,
      behavior: "smooth",
    })
  }
}

const MOBILE_NAV_SELECTOR = ".mobile-liquid-glass-root"

function getSafeBottomOffset(viewportHeight: number) {
  const nav = document.querySelector<HTMLElement>(MOBILE_NAV_SELECTOR)
  const navRect = nav?.getBoundingClientRect()
  if (!navRect || navRect.height === 0) return 24
  return Math.max(24, viewportHeight - navRect.top + 12)
}

function positionPopoverNearTarget(popover: { arrow: HTMLElement; wrapper: HTMLElement }, target: HTMLElement) {
  const applyPosition = () => {
    const targetRect = target.getBoundingClientRect()
    const popoverRect = popover.wrapper.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const gap = 12
    const safeTop = 16
    const safeBottom = getSafeBottomOffset(viewportHeight)
    const maxLeft = viewportWidth - popoverRect.width - 12
    const left = Math.max(12, Math.min(targetRect.left + (targetRect.width - popoverRect.width) / 2, maxLeft))
    const belowTop = targetRect.bottom + gap
    const aboveTop = targetRect.top - popoverRect.height - gap
    const fitsBelow = belowTop + popoverRect.height <= viewportHeight - safeBottom
    const fitsAbove = aboveTop >= safeTop
    const preferredTop = fitsBelow || !fitsAbove ? belowTop : aboveTop
    const top = Math.max(safeTop, Math.min(preferredTop, viewportHeight - safeBottom - popoverRect.height))

    popover.wrapper.style.setProperty("position", "fixed", "important")
    popover.wrapper.style.setProperty("inset", "auto", "important")
    popover.wrapper.style.setProperty("left", `${left}px`, "important")
    popover.wrapper.style.setProperty("right", "auto", "important")
    popover.wrapper.style.setProperty("top", `${top}px`, "important")
    popover.wrapper.style.setProperty("bottom", "auto", "important")

    const nextPopoverRect = popover.wrapper.getBoundingClientRect()
    const arrowRect = popover.arrow.getBoundingClientRect()
    const arrowSize = arrowRect.width || 10
    const arrowInset = 16
    const targetCenterX = targetRect.left + targetRect.width / 2
    const targetCenterY = targetRect.top + targetRect.height / 2
    const popoverCenterX = nextPopoverRect.left + nextPopoverRect.width / 2
    const targetIsBelow = targetRect.top >= nextPopoverRect.bottom
    const targetIsAbove = targetRect.bottom <= nextPopoverRect.top
    const targetIsRight = targetRect.left >= nextPopoverRect.right
    const arrowSide = targetIsBelow
      ? "top"
      : targetIsAbove
        ? "bottom"
        : targetIsRight
          ? "left"
          : "right"

    popover.arrow.className = `driver-popover-arrow driver-popover-arrow-side-${arrowSide}`
    popover.arrow.style.removeProperty("top")
    popover.arrow.style.removeProperty("right")
    popover.arrow.style.removeProperty("bottom")
    popover.arrow.style.removeProperty("left")

    if (arrowSide === "top" || arrowSide === "bottom") {
      const arrowLeft = Math.max(
        arrowInset,
        Math.min(targetCenterX - nextPopoverRect.left - arrowSize / 2, nextPopoverRect.width - arrowInset - arrowSize),
      )
      popover.arrow.style.setProperty("left", `${arrowLeft}px`, "important")
      return
    }

    const arrowTop = Math.max(
      arrowInset,
      Math.min(targetCenterY - nextPopoverRect.top - arrowSize / 2, nextPopoverRect.height - arrowInset - arrowSize),
    )
    popover.arrow.style.setProperty("top", `${arrowTop}px`, "important")
    if (targetCenterX >= popoverCenterX) {
      popover.arrow.className = "driver-popover-arrow driver-popover-arrow-side-left"
    }
  }

  applyPosition()
  requestAnimationFrame(applyPosition)
  window.setTimeout(applyPosition, 320)
}

export function ContextualProductTour({ role }: { role: AppRole }) {
  const pathname = usePathname()
  const { messages } = useLocale()
  const copy = messages.onboarding.productTour
  const { contextualTours, welcomeSteps } = useMemo(() => buildTours(copy), [copy])
  const contextTour = useMemo(() => contextualTours.find((candidate) => candidate.match(pathname)) ?? null, [contextualTours, pathname])
  const tourRuntimeRef = useRef({ controls: copy.controls, welcomeSteps })
  tourRuntimeRef.current = { controls: copy.controls, welcomeSteps }

  useEffect(() => {
    let cancelled = false
    let activeTour: ReturnType<typeof driver> | null = null
    let frame = 0
    let retryTimer: number | null = null

    const startTour = (attempt = 0) => {
      if (cancelled) return
      const { controls, welcomeSteps: currentWelcomeSteps } = tourRuntimeRef.current
      const welcomePending = role === "trainee" && window.localStorage.getItem("yb_onboarding_tour_pending") === "1"
      const selected = welcomePending && !readStorage(WELCOME_KEY)
        ? { key: WELCOME_KEY, steps: currentWelcomeSteps[role] }
        : contextTour && contextTour.roles.includes(role) && !readStorage(`${CONTEXT_KEY_PREFIX}${contextTour.key}`)
          ? { key: `${CONTEXT_KEY_PREFIX}${contextTour.key}`, steps: contextTour.steps }
          : null
      if (!selected || selected.steps.length === 0) return
      // A step behind a tab is kept: its target only renders once the tab opens.
      const availableSteps = selected.steps.filter((step) => !step.target || step.activate || document.querySelector(step.target))
      const targetsHydrated = availableSteps.every((step) => {
        const target = step.target ? document.querySelector(step.target) : null
        return !target || isHydrated(target)
      })
      if (!availableSteps.some((step) => !step.target || document.querySelector(step.target)) || !targetsHydrated) {
        if (attempt < TOUR_START_MAX_ATTEMPTS) {
          retryTimer = window.setTimeout(() => startTour(attempt + 1), TOUR_START_RETRY_MS)
        }
        return
      }

      // Opens the step's tab when its card is not on screen, then lets driver.js
      // wait for the card (or skip it, when the tab has nothing to show).
      const goTo = (index: number) => {
        const step = availableSteps[index]
        if (!step) {
          activeTour?.destroy()
          return
        }
        if (step.activate && step.target && !document.querySelector(step.target)) {
          document.querySelector<HTMLElement>(step.activate)?.click()
          // A new tab starts at its top; the old scroll offset would leave its
          // first card above the screen.
          window.scrollTo({ top: 0 })
        }
        activeTour?.moveTo(index)
      }

      activeTour = driver({
        animate: true,
        waitForElement: STEP_WAIT_MS,
        skipMissingElement: true,
        onNextClick: (_element, _step, { driver: tour }) => goTo((tour.getActiveIndex() ?? 0) + 1),
        onPrevClick: (_element, _step, { driver: tour }) => goTo((tour.getActiveIndex() ?? 0) - 1),
        allowClose: true,
        overlayOpacity: 0.76,
        smoothScroll: true,
        stagePadding: 8,
        popoverOffset: 12,
        showProgress: true,
        progressText: controls.progress("{{current}}", "{{total}}"),
        nextBtnText: controls.next,
        prevBtnText: controls.back,
        doneBtnText: controls.done,
        popoverClass: "yb-tour-popover",
        steps: availableSteps.map((step) => ({
          element: step.target,
          popover: {
            title: step.title,
            description: step.body,
            side: "bottom",
            align: "center",
            onPopoverRender: (popover) => {
              if (!step.target) return
              const target = document.querySelector<HTMLElement>(step.target)
              if (!target) return
              scrollTargetIntoView(target)
              positionPopoverNearTarget(popover, target)
            },
          },
        })),
        onDestroyed: () => {
          writeStorage(selected.key)
          if (selected.key === WELCOME_KEY) {
            window.localStorage.removeItem("yb_onboarding_tour_pending")
            writeStorage(`${CONTEXT_KEY_PREFIX}${DASHBOARD_TOUR_KEY}`)
          }
        },
      })
      activeTour.drive()
    }

    frame = requestAnimationFrame(() => startTour())
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (retryTimer) window.clearTimeout(retryTimer)
      activeTour?.destroy()
    }
  }, [contextTour, pathname, role])

  return null
}
