"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Calendar,
  Dumbbell,
  Utensils,
  BarChart3,
  Users,
  UserPlus,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { AppRole } from "@/lib/auth/types"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { useState } from "react"
import { useLocale } from "@/components/providers/locale-provider"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

interface SidebarProps {
  role?: AppRole
}

export function Sidebar({ role = "trainee" }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { messages } = useLocale()
  const traineeNavItems: NavItem[] = [
    { href: "/dashboard", icon: Home, label: messages.shell.dashboard },
    { href: "/schedule", icon: Calendar, label: messages.shell.weeklySchedule },
    { href: "/workout", icon: Dumbbell, label: messages.shell.workout },
    { href: "/meals", icon: Utensils, label: messages.shell.mealTracking },
    { href: "/progress", icon: BarChart3, label: messages.shell.progress },
    { href: "/coach/find", icon: UserPlus, label: messages.common.addCoach },
  ]
  const coachNavItems: NavItem[] = [
    { href: "/coach", icon: Home, label: messages.shell.dashboard },
    { href: "/coach/trainees", icon: Users, label: messages.shell.trainees },
    { href: "/coach/programs", icon: Dumbbell, label: messages.shell.programs },
  ]
  const adminNavItems: NavItem[] = [{ href: "/admin", icon: ShieldCheck, label: messages.shell.adminDashboard }]
  const navItems = role === "coach" ? coachNavItems : role === "admin" ? adminNavItems : traineeNavItems

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-sidebar transition-all duration-300",
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

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
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

      <div className="border-t border-sidebar-border p-2">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{messages.common.settings}</span>}
        </Link>
      </div>
    </aside>
  )
}
