"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, Dumbbell, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AppRole } from "@/lib/auth/types"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { useEffect, useState } from "react"
import { useLocale } from "@/components/providers/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { SidebarAccountMenu } from "@/components/layout/sidebar-account-menu"
import { fetchCoachDashboard, fetchCoachPrograms } from "@/lib/fitness/api"
import { getAdminNavItems, getCoachNavItems, getTraineeNavItems, isNavItemActive } from "@/components/layout/shell-nav"

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

  const traineeNavItems = getTraineeNavItems(messages)
  const adminNavItems = getAdminNavItems(messages).filter((item) => item.href === "/admin")
  const navItems = role === "admin" ? adminNavItems : traineeNavItems

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen flex-col border-r border-border bg-sidebar transition-all duration-300 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <Link href={getRoleLandingPath(role)} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Dumbbell className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">YeahBuddy</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(collapsed && "mx-auto")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0 transition-transform", isActive && "scale-105")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <SidebarAccountMenu
          collapsed={collapsed}
          extraActions={role === "trainee" ? [{ href: "/coach/find", icon: UserPlus, label: messages.common.addCoach }] : []}
        />
      </div>
    </aside>
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
        const [dashboard, programs] = await Promise.all([
          fetchCoachDashboard(session.access_token),
          fetchCoachPrograms(session.access_token),
        ])

        if (!cancelled) {
          setCounts({
            programs: programs.length,
            trainees: dashboard.summary.totalTrainees,
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
    ["/coach/trainees", "/coach/programs", "/progress"].includes(item.href),
  )

  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-full min-h-0 flex-col px-3.5 py-6">
        <div className="mb-4 flex items-center gap-2.5 px-1">
          <img src="/lift-mark.svg" alt="" className="h-5 w-7 text-foreground" />
          <span className="text-[20px] font-semibold leading-none tracking-[-0.04em] text-foreground">lift</span>
          <span className="ml-auto rounded-[3px] bg-foreground px-1.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-background">
            Coach
          </span>
        </div>

        <Link href="/dashboard" className="mb-6 px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          ← Back to athlete view
        </Link>

        <Button asChild className="mb-7 w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90">
          <Link href="/coach/trainees">
            <UserPlus className="h-4 w-4" />
            Add client
          </Link>
        </Button>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <p className="label-micro mb-2 px-1 text-muted-foreground">Coach</p>
          <nav className="flex flex-col gap-1">
            {coachNavItems.map((item) => {
              const isActive = isNavItemActive(pathname, item)
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.count != null ? (
                    <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="shrink-0 border-t border-border pt-4">
          <SidebarAccountMenu
            avatarClassName="h-7 w-7"
            buttonClassName="gap-2.5 rounded-md px-0 py-2 hover:bg-muted/70"
            fallbackEmail="coach@example.com"
            fallbackInitials="EK"
            fallbackName="Coach Eli K."
            subtitle={<span className="font-mono text-[11px]">12 active clients</span>}
          />
        </div>
      </div>
    </aside>
  )
}
