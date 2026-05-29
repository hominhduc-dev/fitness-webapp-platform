"use client"

import type React from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  Calendar,
  Dumbbell,
  Utensils,
  BarChart3,
  Users,
  ListChecks,
  UserPlus,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AppRole } from "@/lib/auth/types"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { useState } from "react"
import { useLocale } from "@/components/providers/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

interface SidebarProps {
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

export function Sidebar({ role = "trainee" }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { messages } = useLocale()
  const { profile, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (role === "coach") {
    return <CoachSidebar pathname={pathname} />
  }

  const traineeNavItems: NavItem[] = [
    { href: "/dashboard", icon: Home, label: messages.shell.dashboard },
    { href: "/schedule", icon: Calendar, label: messages.shell.weeklySchedule },
    { href: "/workout", icon: Dumbbell, label: messages.shell.workout },
    { href: "/meals", icon: Utensils, label: messages.shell.mealTracking },
    { href: "/progress", icon: BarChart3, label: messages.shell.progress },
    { href: "/coach/find", icon: UserPlus, label: messages.common.addCoach },
  ]
  const adminNavItems: NavItem[] = [{ href: "/admin", icon: ShieldCheck, label: messages.shell.adminDashboard }]
  const navItems = role === "admin" ? adminNavItems : traineeNavItems
  const displayName = profile?.name ?? messages.shell.yeahBuddyUser
  const displayEmail = profile?.email ?? messages.shell.loadingEmail
  const initials = getInitials(displayName) || "YB"

  const handleSignOut = async () => {
    setIsSigningOut(true)

    try {
      await signOut()
      router.push("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

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
          const isActive = isNavItemActive(pathname, item.href)
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-foreground font-mono text-[11px] font-semibold text-background">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!collapsed ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{displayEmail}</span>
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">
                <Settings className="mr-2 h-4 w-4" />
                {messages.common.settings}
              </Link>
            </DropdownMenuItem>
            {role === "trainee" ? (
              <DropdownMenuItem asChild>
                <Link href="/coach/find">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {messages.common.addCoach}
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleSignOut()} disabled={isSigningOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {isSigningOut ? messages.common.signingOut : messages.common.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function CoachSidebar({ pathname }: { pathname: string }) {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { messages } = useLocale()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const displayName = profile?.name ?? "Coach Eli K."
  const displayEmail = profile?.email ?? "coach@example.com"
  const initials = getInitials(displayName) || "EK"
  const coachNavItems = [
    { href: "/coach/trainees", icon: Users, label: "Clients", count: 12 },
    { href: "/coach/programs", icon: ListChecks, label: "Programs", count: 6 },
    { href: "/progress", icon: BarChart3, label: "Stats" },
  ]

  const handleSignOut = async () => {
    setIsSigningOut(true)

    try {
      await signOut()
      router.push("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

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
              const isActive = isNavItemActive(pathname, item.href)
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md px-0 py-2 text-left text-sm transition-colors hover:bg-muted/70"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={profile?.avatar ?? undefined} alt={displayName} />
                  <AvatarFallback className="bg-foreground font-mono text-[11px] font-semibold text-background">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{displayName}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">12 active clients</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <Settings className="mr-2 h-4 w-4" />
                  {messages.common.settings}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleSignOut()} disabled={isSigningOut}>
                <LogOut className="mr-2 h-4 w-4" />
                {isSigningOut ? messages.common.signingOut : messages.common.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  )
}
