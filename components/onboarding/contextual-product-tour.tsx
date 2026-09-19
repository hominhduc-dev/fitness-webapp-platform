"use client"

import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import type { AppRole } from "@/lib/auth/types"
import type { AppMessages } from "@/lib/i18n/messages"

type TourStep = { body: string; target?: string; title: string }
type TourMessages = AppMessages["onboarding"]["productTour"]
const WELCOME_KEY = "yb_product_tour_welcome_v1"
const CONTEXT_KEY_PREFIX = "yb_product_tour_context_v1:"
const DASHBOARD_TOUR_KEY = "trainee-dashboard"
const TOUR_START_RETRY_MS = 80
const TOUR_START_MAX_ATTEMPTS = 8

function buildTours(copy: TourMessages) {
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
    { key: "trainee-workout", roles: ["trainee"], match: (p) => p === "/workout" || p.startsWith("/workout/"), steps: [
      { ...copy.traineeWorkout.today, target: "[data-tour='trainee-workout-today']" },
      { ...copy.traineeWorkout.list, target: "[data-tour='trainee-workout-list']" },
      { ...copy.traineeWorkout.actions, target: "[data-tour='trainee-workout-actions']" },
    ] },
    { key: "trainee-nutrition", roles: ["trainee"], match: (p) => p === "/meals" || p.startsWith("/meals/"), steps: [
      { ...copy.traineeNutrition.summary, target: "[data-tour='trainee-nutrition-summary']" },
      { ...copy.traineeNutrition.log, target: "[data-tour='trainee-nutrition-log']" },
      { ...copy.traineeNutrition.actions, target: "[data-tour='trainee-nutrition-actions']" },
    ] },
    { key: "trainee-progress", roles: ["trainee"], match: (p) => p === "/progress" || p.startsWith("/progress/"), steps: [
      { ...copy.traineeProgress.overview, target: "[data-tour='trainee-progress-overview']" },
      { ...copy.traineeProgress.metrics, target: "[data-tour='trainee-progress-metrics']" },
      { ...copy.traineeProgress.actions, target: "[data-tour='trainee-progress-actions']" },
    ] },
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

  if (!isComfortablyVisible) {
    window.scrollBy({
      top: targetCenter - desiredCenter,
      behavior: "smooth",
    })
  }
}

function positionPopoverNearTarget(popover: { arrow: HTMLElement; wrapper: HTMLElement }, target: HTMLElement) {
  const applyPosition = () => {
    const targetRect = target.getBoundingClientRect()
    const popoverRect = popover.wrapper.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const gap = 12
    const safeTop = 16
    const safeBottom = Math.max(112, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom-offset")) || 0)
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
      const availableSteps = selected.steps.filter((step) => !step.target || document.querySelector(step.target))
      if (availableSteps.length === 0) {
        if (attempt < TOUR_START_MAX_ATTEMPTS) {
          retryTimer = window.setTimeout(() => startTour(attempt + 1), TOUR_START_RETRY_MS)
        }
        return
      }

      activeTour = driver({
        animate: true,
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
