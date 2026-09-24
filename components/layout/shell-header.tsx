"use client"

import Link from "next/link"
import { LogOut, Settings, User, X } from "lucide-react"
import { Fragment, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { AppRole } from "@/lib/auth/types"
import { BrandLogo } from "@/components/ui/brand-logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LanguageToggle } from "@/components/layout/language-toggle"
import { SyncStatusBadge } from "@/components/offline/sync-status-badge"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ActiveShellPageTitle, ShellPageTitle } from "@/components/layout/shell-page-title"
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
  onSelect,
}: {
  items: ShellNavItem[]
  onSelect: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSection = searchParams.get("s")

  function isActive(item: ShellNavItem): boolean {
    return isNavItemActive(pathname, item, currentSection)
  }

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          onClick={onSelect}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
            isActive(item)
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span>{item.label}</span>
          {item.count != null ? (
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 font-mono text-micro leading-none text-muted-foreground">
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
/* Bottom nav links — split out because useSearchParams needs its own   */
/* Suspense boundary; the query decides which admin tab is current.     */
/* ------------------------------------------------------------------ */
// The floating nav's padding (`px-1.5 py-1.5`) and column gap (`gap-0.5`), in px.
const NAV_PAD_PX = 6
const NAV_GAP_PX = 2
/** Horizontal travel before a press on the nav becomes a slide. */
const NAV_DRAG_START_PX = 6
/** How long after a slide the click it ends with is ignored. */
const NAV_SUPPRESS_CLICK_MS = 400

function MobileNavLinkList({
  items,
  onSelect,
  open,
  pathname,
  section,
}: {
  items: ShellNavItem[]
  onSelect: () => void
  open: boolean
  pathname: string
  section: string | null
}) {
  const router = useRouter()
  const count = items.length
  const activeIndex = open ? -1 : items.findIndex((item) => isNavItemActive(pathname, item, section))
  // While a finger slides along the nav: where the glass is, and the tab under it.
  const [drag, setDrag] = useState<{ left: number; width: number; index: number } | null>(null)
  const gesture = useRef<{ pointerId: number; startX: number; dragging: boolean; navLeft: number; navWidth: number } | null>(null)
  const suppressClickUntil = useRef(0)
  // Replays the liquid squish each time the glass moves to another tab (not on load).
  const [lastIndex, setLastIndex] = useState(activeIndex)
  const [moves, setMoves] = useState(0)
  if (activeIndex !== lastIndex) {
    setLastIndex(activeIndex)
    if (lastIndex >= 0 && activeIndex >= 0) setMoves((value) => value + 1)
  }

  const measure = (x: number, navWidth: number) => {
    const width = (navWidth - 2 * NAV_PAD_PX - (count - 1) * NAV_GAP_PX) / count
    const index = Math.min(count - 1, Math.max(0, Math.floor((x - NAV_PAD_PX) / (width + NAV_GAP_PX))))
    const left = Math.min(navWidth - NAV_PAD_PX - width, Math.max(NAV_PAD_PX, x - width / 2))
    return { left, width, index }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    const nav = event.currentTarget.closest("nav")
    if (!nav) return
    const rect = nav.getBoundingClientRect()
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, dragging: false, navLeft: rect.left, navWidth: rect.width }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    if (!current.dragging) {
      if (Math.abs(event.clientX - current.startX) < NAV_DRAG_START_PX) return
      current.dragging = true
      try {
        ;(event.target as Element).setPointerCapture(event.pointerId)
      } catch {
        // Pointer already gone: the slide still ends on pointerup/cancel.
      }
    }
    setDrag(measure(event.clientX - current.navLeft, current.navWidth))
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    gesture.current = null
    if (!current || current.pointerId !== event.pointerId || !current.dragging) return
    const { index } = measure(event.clientX - current.navLeft, current.navWidth)
    setDrag(null)
    // The press ends in a click on the tab it started on; that one is not the choice.
    suppressClickUntil.current = performance.now() + NAV_SUPPRESS_CLICK_MS
    onSelect()
    if (index !== activeIndex) router.push(items[index].href)
  }

  const handlePointerCancel = () => {
    gesture.current = null
    setDrag(null)
  }

  const shownIndex = drag ? drag.index : activeIndex
  // At rest the glass is placed by column in CSS, so it is right from the first
  // server paint; while sliding it follows the finger in px.
  const columnWidth = `((100% - ${2 * NAV_PAD_PX}px - ${(count - 1) * NAV_GAP_PX}px) / ${count})`
  const indicatorStyle = drag
    ? { left: `${drag.left}px`, width: `${drag.width}px` }
    : { left: `calc(${NAV_PAD_PX}px + ${Math.max(activeIndex, 0)} * (${columnWidth} + ${NAV_GAP_PX}px))`, width: `calc(${columnWidth})` }

  return (
    <div
      className="contents"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={(event) => {
        if (performance.now() < suppressClickUntil.current) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      {/* The liquid-glass lens behind the active tab. It slides between tabs with
          a slight overshoot and a squish, and follows the finger on a slide. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-1.5 z-0",
          !drag && "transition-[left,width,opacity] duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none",
          shownIndex < 0 ? "opacity-0" : "opacity-100",
        )}
        style={indicatorStyle}
      >
        <span
          key={moves}
          className={cn(
            "block size-full rounded-[1.25rem] border border-primary/15 bg-primary-soft shadow-[inset_0_1px_0_var(--glass-rim-soft),0_6px_16px_-8px_var(--primary)] transition-transform duration-200",
            drag ? "scale-[1.06]" : moves > 0 && "animate-[nav-liquid-squish_460ms_ease-out] motion-reduce:animate-none",
          )}
        />
      </span>
      {items.map((item, index) => {
        const active = index === activeIndex
        const visuallyActive = index === shownIndex
        return (
          // Close the More sheet on tap rather than waiting for the route
          // change: tapping the current page's icon never changes the
          // pathname, so the sheet used to stay open until "More" was
          // tapped again.
          <Link key={item.href} href={item.href} prefetch onClick={onSelect} aria-current={active ? "page" : undefined} title={item.label} className={cn("relative z-10 flex min-w-0 touch-none flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-0.5 py-1.5 transition-[color,transform] duration-200 ease-out active:scale-[0.96]", visuallyActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            <item.icon className="h-5 w-5" strokeWidth={visuallyActive ? 2 : 1.7} aria-hidden="true" />
            <span className={cn("max-w-full truncate text-[0.6875rem] leading-4", visuallyActive && "font-semibold")}>{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

function MobileNavLinks(props: { items: ShellNavItem[]; onSelect: () => void; open: boolean; pathname: string }) {
  const searchParams = useSearchParams()
  return <MobileNavLinkList {...props} section={searchParams.get("s")} />
}

function initials(name: string | null | undefined) {
  return (name ?? "")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

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

  useEffect(() => {
    function handleOpenMobileMore() {
      setOpen(true)
    }

    window.addEventListener("yeahbuddy:open-mobile-more", handleOpenMobileMore)
    return () => window.removeEventListener("yeahbuddy:open-mobile-more", handleOpenMobileMore)
  }, [])

  // Build nav items per role
  // For admin, exclude /profile from the nav list — it's shown in the footer section
  const navItems =
    role === "admin"
      ? getAdminNavItems(messages).filter((item) => !item.href.startsWith("/profile"))
      : role === "coach"
        ? getCoachNavItems(messages)
        : getTraineeNavItems(messages)

  const badge = ROLE_BADGE[role]
  // Pages opened from menus rather than the nav still get a title.
  const titleItems = [
    ...navItems,
    { href: "/profile", label: messages.profile.title },
    { href: "/trackweight", label: messages.progressPage.title },
  ]
  const profileName = profile?.name ?? profile?.email ?? "YeahBuddy"
  // The trainee nav keeps Weekly Schedule in the center under the shorter
  // product label "Routine" so the five mobile destinations stay stable.
  const primaryItems = role === "trainee"
    ? (() => {
        const traineeItems = getTraineeNavItems(messages, { compactLabels: true })
        const scheduleItem = traineeItems[4]

        return [
          traineeItems[0],
          traineeItems[1],
          { ...scheduleItem, label: messages.shell.routine },
          traineeItems[2],
          traineeItems[3],
        ]
      })()
    : role === "admin"
      ? (() => {
          const adminItems = getAdminNavItems(messages, { compactLabels: true })
          const bottomNavHrefs = ["/admin", "/admin?s=users", "/admin?s=coach-signups", "/admin?s=requests", "/admin?s=exercises"]

          return bottomNavHrefs
            .map((href) => adminItems.find((item) => item.href === href))
            .filter((item): item is ShellNavItem => Boolean(item))
        })()
      : navItems.slice(0, 4)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    setOpen(false)
    try {
      await signOut()
      router.push("/")
    } finally {
      setIsSigningOut(false)
    }
  }

  // The trainee dashboard opens with its own greeting, so neither title bar shows there.
  const hideTitle = role === "trainee" && pathname === "/dashboard"

  return (
    <Fragment>
      {/* Desktop: the sidebar already carries navigation and the bell, so this
          is only the page title above the content. */}
      <header className={cn("hidden px-6 pb-1 pt-6 md:block lg:px-9", hideTitle && "md:hidden")}>
        <Suspense fallback={<ShellPageTitle size="large" subtitle={messages.dashboard.welcomeBack} title="YeahBuddy" />}>
          <ActiveShellPageTitle
            badge={badge}
            items={titleItems}
            pathname={pathname}
            size="large"
            subtitle={messages.dashboard.welcomeBack}
          />
        </Suspense>
      </header>

      {/* Pinned: the page scrolls under it, so the account menu and the
          notification bell stay reachable without scrolling back up. */}
      <header className={cn(
        "sticky top-0 z-40 bg-background px-3 pb-2 pt-[calc(0.45rem+env(safe-area-inset-top))] md:hidden",
        hideTitle && "hidden",
      )}>
        <div className="mx-auto flex w-full max-w-[96rem] items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              aria-label={open ? messages.common.closeNavigation : messages.common.openNavigation}
              aria-controls="mobile-more-navigation"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="size-11 border border-border bg-muted">
                {profile?.avatar ? <AvatarImage src={profile.avatar} alt={profileName} className="object-cover" /> : null}
                <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                  {initials(profileName) || <User className="size-5" strokeWidth={1.7} aria-hidden="true" />}
                </AvatarFallback>
              </Avatar>
            </button>
            <Suspense fallback={<ShellPageTitle className="pt-1" subtitle={messages.dashboard.welcomeBack} title="YeahBuddy" />}>
              <ActiveShellPageTitle
                badge={badge}
                className="pt-1"
                items={titleItems}
                pathname={pathname}
                subtitle={messages.dashboard.welcomeBack}
              />
            </Suspense>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <SyncStatusBadge />
            <NotificationBell
              className="size-10 bg-transparent text-foreground hover:bg-muted/40 [&_svg]:size-6"
              side="bottom"
            />
          </div>
        </div>
      </header>

      <div className="mobile-liquid-glass-root fixed bottom-[var(--mobile-nav-offset)] left-1/2 z-50 w-[calc(100%-2rem)] max-w-[390px] -translate-x-1/2 md:hidden">
        <div aria-hidden="true" className="mobile-liquid-glass-scene pointer-events-none absolute inset-0 rounded-full" />
        <nav
          className={cn(
            "mobile-floating-nav glass-surface relative grid w-full gap-0.5 rounded-[1.75rem] border border-border bg-background/45 px-1.5 py-1.5 shadow-2xl backdrop-blur-xl",
            role === "coach" ? "grid-cols-4" : "grid-cols-5",
          )}
        >
          <Suspense
            fallback={<MobileNavLinkList items={primaryItems} onSelect={() => setOpen(false)} open={open} pathname={pathname} section={null} />}
          >
            <MobileNavLinks items={primaryItems} onSelect={() => setOpen(false)} open={open} pathname={pathname} />
          </Suspense>
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
          <nav id="mobile-more-navigation" className="glass-surface fixed bottom-[calc(var(--mobile-nav-offset)+5.25rem)] left-3 right-3 z-50 max-h-[calc(100dvh-var(--mobile-nav-offset)-8.25rem)] overflow-y-auto rounded-3xl border border-border bg-background p-2.5 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-2"><BrandLogo markClassName="size-7 rounded-none" textClassName="text-base" />{badge ? <span className="label-micro">{badge}</span> : null}</div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            {/* Role nav items */}
            <Suspense fallback={null}>
              <NavItems items={navItems} onSelect={() => setOpen(false)} />
            </Suspense>

            {/* ── Footer section: settings + logout ── */}
            <div className="my-2 h-px bg-border" />

            <div className="px-3 py-2">
              <p className="mb-1.5 font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {messages.common.language}
              </p>
              <LanguageToggle variant="select" />
            </div>

            <div className="px-3 py-2">
              <p className="mb-1.5 font-mono text-micro font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {messages.common.theme}
              </p>
              <ThemeToggle variant="select" />
            </div>

            <Link
              href="/profile"
              prefetch
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Settings className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{messages.common.settings}</span>
            </Link>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive-text disabled:opacity-50"
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
