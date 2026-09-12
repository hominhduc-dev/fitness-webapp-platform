"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Dumbbell, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AppRole } from "@/lib/auth/types"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { useEffect, useState } from "react"
import { useLocale } from "@/components/providers/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { SidebarAccountMenu } from "@/components/layout/sidebar-account-menu"
import { fetchCoachNavCounts } from "@/lib/fitness/api"
import { getAdminNavItems, getCoachNavItems, getTraineeNavItems, isNavItemActive } from "@/components/layout/shell-nav"
import { BaseSidebar } from "@/components/layout/base-sidebar"

interface SidebarProps {
  role?: AppRole
}

export function Sidebar({ role = "trainee" }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { messages } = useLocale()

  if (role === "coach") {
    return <CoachSidebar pathname={pathname} />
  }

  if (role === "admin") {
    return <AdminSidebar pathname={pathname} />
  }

  const traineeNavItems = getTraineeNavItems(messages)

  return (
    <BaseSidebar
      collapsible
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed(!collapsed)}
      sections={[{ items: traineeNavItems }]}
      isActiveItem={(item) => isNavItemActive(pathname, item)}
      activeStyle="primary"
      brand={
        <Link href={getRoleLandingPath(role)} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">YeahBuddy</span>
        </Link>
      }
      footer={
        <SidebarAccountMenu
          collapsed={collapsed}
          extraActions={[{ href: "/coach/find", icon: UserPlus, label: messages.common.addCoach }]}
        />
      }
    />
  )
}

function AdminSidebar({ pathname }: { pathname: string }) {
  const { messages } = useLocale()
  const searchParams = useSearchParams()
  const currentSection = searchParams.get("s")
  const adminNavItems = getAdminNavItems(messages)

  function isAdminItemActive(item: (typeof adminNavItems)[number]): boolean {
    // "/profile" — pure pathname match
    if (item.href === "/profile") return pathname === "/profile"
    // "/admin" (no ?s=) — active only when no section param
    if (item.href === "/admin") return pathname === "/admin" && !currentSection
    // "/admin?s=xxx" — active when pathname is /admin and ?s matches
    const itemSection = item.href.split("?s=")[1]
    return pathname === "/admin" && currentSection === itemSection
  }

  // Separate admin section items from settings
  const sectionItems = adminNavItems.filter((i) => !i.href.startsWith("/profile"))
  const settingsItems = adminNavItems.filter((i) => i.href.startsWith("/profile"))

  const sections = [
    { title: messages.shell.controlCenter, items: sectionItems },
    ...(settingsItems.length > 0 ? [{ title: messages.shell.account, items: settingsItems }] : []),
  ]

  return (
    <BaseSidebar
      collapsible={false}
      sections={sections}
      isActiveItem={isAdminItemActive}
      activeStyle="muted"
      brand={
        <Link href={getRoleLandingPath("admin")} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">YeahBuddy</span>
        </Link>
      }
      backLink={
        <Link href="/dashboard">
          ← {messages.shell.backToAthleteView}
        </Link>
      }
      footer={
        <SidebarAccountMenu
          avatarClassName="h-7 w-7"
          buttonClassName="gap-2.5 rounded-md px-0 py-2 hover:bg-muted/70"
        />
      }
    />
  )
}

function CoachSidebar({ pathname }: { pathname: string }) {
  const { session } = useAuth()
  const { messages } = useLocale()
  const [counts, setCounts] = useState<{ programs?: number; trainees?: number }>({})

  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      if (!session?.access_token) {
        setCounts({})
        return
      }

      try {
        const navCounts = await fetchCoachNavCounts(session.access_token)

        if (!cancelled) {
          setCounts({
            programs: navCounts.programs,
            trainees: navCounts.trainees,
          })
        }
      } catch {
        if (!cancelled) {
          setCounts({})
        }
      }
    }

    void loadCounts()

    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  const coachNavItems = getCoachNavItems(messages, counts).filter((item) =>
    ["/coach/trainees", "/coach/programs", "/coach/exercises", "/progress"].includes(item.href),
  )

  return (
    <BaseSidebar
      collapsible={false}
      sections={[{ title: "Coach", items: coachNavItems }]}
      isActiveItem={(item) => isNavItemActive(pathname, item)}
      activeStyle="muted"
      brand={
        <Link href={getRoleLandingPath("coach")} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">YeahBuddy</span>
        </Link>
      }
      backLink={
        <Link href="/dashboard">
          ← {messages.shell.backToAthleteView}
        </Link>
      }
      cta={
        <Button asChild className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90">
          <Link href="/coach/trainees">
            <UserPlus className="h-4 w-4" />
            {messages.shell.addClient}
          </Link>
        </Button>
      }
      footer={
        <SidebarAccountMenu
          avatarClassName="h-7 w-7"
          buttonClassName="gap-2.5 rounded-md px-0 py-2 hover:bg-muted/70"
          fallbackEmail="coach@example.com"
          fallbackInitials="EK"
          fallbackName="Coach Eli K."
          subtitle={<span className="font-mono text-micro">12 {messages.shell.activeClients}</span>}
        />
      }
    />
  )
}
