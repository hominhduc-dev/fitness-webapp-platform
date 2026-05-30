"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Plus, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AppRole } from "@/lib/auth/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function BarbellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
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

interface MobileHeaderProps {
  role?: AppRole
}

export function MobileHeader({ role = "trainee" }: MobileHeaderProps) {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { messages } = useLocale()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const displayName = profile?.name ?? messages.shell.yeahBuddyUser
  const displayEmail = profile?.email ?? messages.shell.loadingEmail
  const initials = getInitials(displayName) || "YB"
  const isCoach = role === "coach"
  const homeHref = isCoach ? "/coach" : "/dashboard"
  const quickActionHref = isCoach ? "/coach/programs/new" : "/workout"
  const quickActionLabel = isCoach ? messages.coach.createProgram : messages.shell.startWorkout

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
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-lg md:hidden">
      <Link href={homeHref} className="flex min-w-0 items-center gap-2 text-foreground">
        <BarbellIcon className="h-5 w-5" />
        <span className="truncate text-base font-bold tracking-tight">YeahBuddy</span>
      </Link>

      <div className="flex items-center gap-2.5">
        <Link
          href={quickActionHref}
          className={cn(
            "inline-flex h-8 max-w-[132px] items-center gap-1.5 rounded-full bg-primary px-3.5",
            "font-mono text-xs font-semibold text-primary-foreground",
            "transition-opacity active:opacity-80",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="truncate">{quickActionLabel}</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-foreground font-mono text-[10px] font-semibold text-background">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-0.5">
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
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleSignOut()} disabled={isSigningOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {isSigningOut ? messages.common.signingOut : messages.common.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
