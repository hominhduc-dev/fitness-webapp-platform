"use client"

import Link from "next/link"
import { Dumbbell, LogOut, MoreHorizontal, Settings, X } from "lucide-react"
import { Fragment, Suspense, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { AppRole } from "@/lib/auth/types"
import { LanguageToggle } from "@/components/layout/language-toggle"
import { ThemeToggle } from "@/components/layout/theme-toggle"
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
import { useLiquidGlass } from "@/components/ui/use-liquid-glass"

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
  const { signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const mobileNavRef = useRef<HTMLElement>(null)

  useLiquidGlass(mobileNavRef, {
    blurAmount: 0.4,
    refraction: 0.72,
    chromAberration: 0.05,
    edgeHighlight: 0.14,
    specular: 0.12,
    fresnel: 0.9,
    cornerRadius: 32,
    zRadius: 28,
    brightness: -0.08,
    saturation: 0.12,
    shadowOpacity: 0.24,
    shadowSpread: 12,
  })

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
  const primaryItems = navItems.slice(0, 4)

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
    <Fragment>
      <div className="mobile-liquid-glass-root fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-2rem)] max-w-[390px] -translate-x-1/2 md:hidden">
        <div aria-hidden="true" className="mobile-liquid-glass-scene pointer-events-none absolute inset-0 rounded-full" />
        <nav ref={mobileNavRef} className="mobile-floating-nav glass-surface relative grid w-full grid-cols-5 rounded-full border border-border bg-background/45 px-2 py-2 shadow-2xl backdrop-blur-xl">
          {primaryItems.map((item) => {
            const active = isNavItemActive(pathname, item)
            return (
              <Link key={item.href} href={item.href} aria-label={item.label} title={item.label} className={cn("flex min-w-0 items-center justify-center rounded-full px-1 py-2.5 transition-all", active ? "bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                <item.icon className="h-5 w-5" strokeWidth={1.7} />
                <span className="sr-only">{item.label}</span>
              </Link>
            )
          })}
          <button type="button" aria-label={open ? messages.common.closeNavigation : messages.common.openNavigation} title="More" onClick={() => setOpen((value) => !value)} className={cn("flex min-w-0 items-center justify-center rounded-full px-1 py-2.5 transition-all", open ? "bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
            <MoreHorizontal className="h-5 w-5" />
            <span className="sr-only">More</span>
          </button>
        </nav>
      </div>

      {/* ── Dropdown ── */}
      {open ? (
        <>
          <button
            type="button"
            aria-label={messages.common.closeNavigation}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-background/45 backdrop-blur-[2px]"
          />
          <nav className="glass-surface fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] overflow-y-auto rounded-[22px] border border-border bg-background p-2.5 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2"><Dumbbell className="h-4 w-4" /><span className="font-semibold">YeahBuddy</span>{badge ? <span className="label-micro">{badge}</span> : null}</div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            {/* Role nav items */}
            <Suspense fallback={null}>
              <NavItems items={navItems} role={role} onSelect={() => setOpen(false)} />
            </Suspense>

            {/* ── Footer section: settings + logout ── */}
            <div className="my-2 h-px bg-border" />

            <div className="px-3 py-2">
              <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {messages.common.language}
              </p>
              <LanguageToggle variant="select" />
            </div>

            <div className="px-3 py-2">
              <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {messages.common.theme}
              </p>
              <ThemeToggle variant="select" />
            </div>

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
              className="flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{isSigningOut ? messages.common.signingOut : messages.common.signOut}</span>
            </button>
          </nav>
        </>
      ) : null}
    </Fragment>
  )
}
