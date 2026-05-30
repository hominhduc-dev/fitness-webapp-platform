"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import type { AppRole } from "@/lib/auth/types"
import { useLocale } from "@/components/providers/locale-provider"
import {
  getAdminNavItems,
  getCoachNavItems,
  getTraineeNavItems,
  isNavItemActive,
  type ShellNavItem,
} from "@/components/layout/shell-nav"
import { cn } from "@/lib/utils"

const ROLE_BADGE: Partial<Record<AppRole, string>> = {
  admin: "Admin",
  coach: "Coach",
}

function NavItems({
  items,
  role,
  onSelect,
}: {
  items: ShellNavItem[]
  role: AppRole
  onSelect: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSection = searchParams.get("s")

  function isActive(item: ShellNavItem): boolean {
    // Admin items use query-string-based routing (/admin?s=users)
    if (role === "admin" && item.href.includes("?s=")) {
      const section = new URLSearchParams(item.href.split("?")[1]).get("s")
      return pathname === "/admin" && currentSection === section
    }
    // Overview: active when on /admin with no section
    if (role === "admin" && item.href === "/admin") {
      return pathname === "/admin" && !currentSection
    }
    return isNavItemActive(pathname, item)
  }

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onSelect}
          className={cn(
            "flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm transition-colors",
            isActive(item)
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span>{item.label}</span>
          {item.count != null ? (
            <span className="ml-auto rounded-full bg-background px-2 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </>
  )
}

export function ShellHeader({ role = "trainee" }: { role?: AppRole }) {
  const { messages } = useLocale()
  const [open, setOpen] = useState(false)

  const navItems =
    role === "admin"
      ? getAdminNavItems(messages)
      : role === "coach"
        ? getCoachNavItems(messages)
        : getTraineeNavItems(messages)

  const badge = ROLE_BADGE[role]

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <img src="/lift-mark.svg" alt="" className="h-5 w-[22px]" />
          <span className="text-[18px] font-semibold leading-none tracking-[-0.04em] text-foreground">
            yeahbuddy
          </span>
          {badge ? (
            <span className="rounded-[3px] bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-background">
              {badge}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Dropdown nav */}
      {open ? (
        <nav className="border-b border-border bg-background p-2.5">
          <NavItems items={navItems} role={role} onSelect={() => setOpen(false)} />
        </nav>
      ) : null}
    </div>
  )
}
