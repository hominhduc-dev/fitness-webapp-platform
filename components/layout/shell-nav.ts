import type { ElementType } from "react"
import { Activity, BarChart3, Calendar, ClipboardList, Dumbbell, Home, LayoutDashboard, Link2, ListChecks, ScrollText, Settings, ShieldCheck, UserPlus, UserRoundCheck, Users, Utensils } from "lucide-react"

import type { AppMessages } from "@/lib/i18n/messages"

export type ShellNavItem = {
  count?: number
  exact?: boolean
  href: string
  icon: ElementType
  label: string
}

type CoachCounts = {
  programs?: number
  trainees?: number
}

export function isNavItemActive(pathname: string, item: Pick<ShellNavItem, "exact" | "href">) {
  if (pathname === item.href) {
    return true
  }

  if (item.exact || item.href === "/coach" || item.href === "/admin" || item.href === "/dashboard") {
    return false
  }

  return pathname.startsWith(`${item.href}/`)
}

export function getTraineeNavItems(messages: AppMessages, options?: { compactLabels?: boolean }): ShellNavItem[] {
  return [
    { exact: true, href: "/dashboard", icon: Home, label: options?.compactLabels ? messages.shell.home : messages.shell.dashboard },
    { href: "/schedule", icon: Calendar, label: options?.compactLabels ? messages.shell.schedule : messages.shell.weeklySchedule },
    { href: "/workout", icon: Dumbbell, label: messages.shell.workout },
    { href: "/meals", icon: Utensils, label: options?.compactLabels ? messages.shell.meals : messages.shell.mealTracking },
    { href: "/progress", icon: BarChart3, label: messages.shell.progress },
    { href: "/coach/find", icon: UserPlus, label: messages.common.addCoach },
  ]
}

export function getCoachNavItems(messages: AppMessages, counts?: CoachCounts): ShellNavItem[] {
  return [
    { exact: true, href: "/coach", icon: Home, label: messages.shell.home },
    { count: counts?.trainees, href: "/coach/trainees", icon: Users, label: "Clients" },
    { count: counts?.programs, href: "/coach/programs", icon: ListChecks, label: messages.shell.programs },
    { href: "/coach/exercises", icon: Activity, label: "Exercises" },
    { href: "/progress", icon: BarChart3, label: "Stats" },
  ]
}

export function getAdminNavItems(messages: AppMessages): ShellNavItem[] {
  return [
    { exact: true, href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin?s=users", icon: Users, label: "Users" },
    { href: "/admin?s=requests", icon: UserRoundCheck, label: "Coach Requests" },
    { href: "/admin?s=connections", icon: Link2, label: "Connections" },
    { href: "/admin?s=programs", icon: ClipboardList, label: "Programs" },
    { href: "/admin?s=exercises", icon: Dumbbell, label: "Exercises" },
    { href: "/admin?s=audit", icon: ScrollText, label: "Audit" },
    { href: "/profile", icon: Settings, label: messages.common.settings },
  ]
}
