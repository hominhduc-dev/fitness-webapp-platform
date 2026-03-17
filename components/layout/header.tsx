"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Bell, Settings, Menu } from "lucide-react"
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
import { LocaleToggle } from "@/components/locale/locale-toggle"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { getRoleLandingPath } from "@/lib/auth/roles"

interface HeaderProps {
  showMenu?: boolean
  onMenuClick?: () => void
}

export function Header({ showMenu, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { isLoading, profile, signOut } = useAuth()
  const { messages } = useLocale()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const dashboardHref = getRoleLandingPath(profile?.role)
  const displayName = profile?.name ?? messages.shell.yeahBuddyUser
  const displayEmail = profile?.email ?? messages.shell.loadingEmail
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)

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
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-lg">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {showMenu && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <Link href={dashboardHref} className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Dumbbell className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden truncate text-lg font-bold tracking-tight sm:inline">YeahBuddy</span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LocaleToggle compact />
          <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full" disabled={isLoading}>
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  <AvatarImage src={profile?.avatar || "/placeholder.svg"} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary">{initials || "YB"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <Settings className="mr-2 h-4 w-4" />
                  {messages.common.settings}
                </Link>
              </DropdownMenuItem>
              {profile?.role === "trainee" && (
                <DropdownMenuItem asChild>
                  <Link href="/coach/find">{messages.common.addCoach}</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleSignOut()} disabled={isSigningOut}>
                {isSigningOut ? messages.common.signingOut : messages.common.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function Dumbbell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.828l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
      <path d="m21.5 21.5-1.4-1.4" />
      <path d="M3.9 3.9 2.5 2.5" />
      <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
    </svg>
  )
}
