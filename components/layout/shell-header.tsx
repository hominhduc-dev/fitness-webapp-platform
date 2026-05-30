"use client"

import Link from "next/link"
import { LogOut, Menu, Settings, X } from "lucide-react"
import { Suspense, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { AppRole } from "@/lib/auth/types"
import { useAuth } from "@/components/providers/auth-provider"
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

/* ------------------------------------------------------------------ */
/* NavItems — needs useSearchParams so must stay in its own component  */
/* ------------------------------------------------------------------ */
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
    if (role === "admin" && item.href.includes("?s=")) {
      const section = new URLSearchParams(item.href.split("?")[1]).get("s")
      return pathname === "/admin" && currentSection === section
    }
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
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* ShellHeader                                                          */
/* ------------------------------------------------------------------ */
export function ShellHeader({ role = "trainee" }: { role?: AppRole }) {
  const { messages } = useLocale()
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Auto-close when the route changes (e.g. after clicking a nav link)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Build nav items per role
  // For admin, exclude /profile from the nav list — it's shown in the footer section
  const navItems =
    role === "admin"
      ? getAdminNavItems(messages).filter((item) => !item.href.startsWith("/profile"))
      : role === "coach"
        ? getCoachNavItems(messages)
        : getTraineeNavItems(messages)

  const badge = ROLE_BADGE[role]

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setOpen(false)
    try {
      await signOut()
      router.push("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="md:hidden">
      {/* ── Top bar ── */}
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

      {/* ── Dropdown ── */}
      {open ? (
        <nav className="border-b border-border bg-background p-2.5">
          {/* Role nav items */}
          <Suspense fallback={null}>
            <NavItems items={navItems} role={role} onSelect={() => setOpen(false)} />
          </Suspense>

          {/* ── Footer section: settings + logout ── */}
          <div className="my-2 h-px bg-border" />

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Settings className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{messages.common.settings}</span>
          </Link>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{isSigningOut ? messages.common.signingOut : messages.common.signOut}</span>
          </button>
        </nav>
      ) : null}
    </div>
  )
}
