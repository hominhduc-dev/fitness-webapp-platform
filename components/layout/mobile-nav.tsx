"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, Dumbbell, Utensils, BarChart3, Users, Settings, ShieldCheck, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppRole } from "@/lib/auth/types"
import { useLocale } from "@/components/providers/locale-provider"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

interface MobileNavProps {
  role?: AppRole
}

function isNavItemActive(pathname: string, href: string) {
  if (pathname === href) {
    return true
  }

  if (href === "/coach" || href === "/admin" || href === "/dashboard") {
    return false
  }

  return pathname.startsWith(`${href}/`)
}

export function MobileNav({ role = "trainee" }: MobileNavProps) {
  const pathname = usePathname()
  const { messages } = useLocale()
  const traineeNavItems: NavItem[] = [
    { href: "/dashboard", icon: Home, label: messages.shell.home },
    { href: "/schedule", icon: Calendar, label: messages.shell.schedule },
    { href: "/workout", icon: Dumbbell, label: messages.shell.workout },
    { href: "/meals", icon: Utensils, label: messages.shell.meals },
    { href: "/progress", icon: BarChart3, label: messages.shell.progress },
  ]
  const coachNavItems: NavItem[] = [
    { href: "/coach", icon: Home, label: messages.shell.home },
    { href: "/coach/trainees", icon: Users, label: messages.shell.trainees },
    { href: "/coach/programs", icon: Dumbbell, label: messages.shell.programs },
    { href: "/coach/exercises", icon: Activity, label: "Exercises" },
  ]
  const adminNavItems: NavItem[] = [
    { href: "/admin", icon: ShieldCheck, label: messages.shell.admin },
    { href: "/profile", icon: Settings, label: messages.common.settings },
  ]
  const navItems = role === "coach" ? coachNavItems : role === "admin" ? adminNavItems : traineeNavItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-105")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
