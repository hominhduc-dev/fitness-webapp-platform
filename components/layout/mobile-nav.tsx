"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calendar, Dumbbell, Utensils, BarChart3, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

const traineeNavItems: NavItem[] = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/schedule", icon: Calendar, label: "Schedule" },
  { href: "/workout", icon: Dumbbell, label: "Workout" },
  { href: "/meals", icon: Utensils, label: "Meals" },
  { href: "/progress", icon: BarChart3, label: "Progress" },
]

const coachNavItems: NavItem[] = [
  { href: "/coach", icon: Home, label: "Home" },
  { href: "/coach/trainees", icon: Users, label: "Trainees" },
  { href: "/coach/programs", icon: Dumbbell, label: "Programs" },
  { href: "/coach/analytics", icon: BarChart3, label: "Analytics" },
]

interface MobileNavProps {
  role?: "trainee" | "coach"
}

export function MobileNav({ role = "trainee" }: MobileNavProps) {
  const pathname = usePathname()
  const navItems = role === "coach" ? coachNavItems : traineeNavItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
