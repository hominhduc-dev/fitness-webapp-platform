"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { AppRole } from "@/lib/auth/types"
import { useLocale } from "@/components/providers/locale-provider"
import { getAdminNavItems, getCoachNavItems, getTraineeNavItems, isNavItemActive } from "@/components/layout/shell-nav"

interface MobileNavProps {
  role?: AppRole
}

export function MobileNav({ role = "trainee" }: MobileNavProps) {
  const pathname = usePathname()
  const { messages } = useLocale()
  const traineeNavItems = getTraineeNavItems(messages, { compactLabels: true }).filter((item) => item.href !== "/coach/find")
  const coachNavItems = getCoachNavItems(messages).filter((item) => item.href !== "/progress")
  const adminNavItems = getAdminNavItems(messages).map((item) =>
    item.href === "/admin" ? { ...item, label: messages.shell.admin } : item,
  )
  const navItems = role === "coach" ? coachNavItems : role === "admin" ? adminNavItems : traineeNavItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = isNavItemActive(pathname, item)
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
