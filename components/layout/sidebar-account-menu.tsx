"use client"

import type React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Settings } from "lucide-react"
import { useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type SidebarAccountAction = {
  href: string
  icon: React.ElementType
  label: string
}

type SidebarAccountMenuProps = {
  avatarClassName?: string
  buttonClassName?: string
  collapsed?: boolean
  dropdownAlign?: "start" | "center" | "end"
  dropdownSide?: "top" | "right" | "bottom" | "left"
  extraActions?: SidebarAccountAction[]
  fallbackEmail?: string
  fallbackName?: string
  fallbackInitials?: string
  showText?: boolean
  subtitle?: React.ReactNode
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

export function SidebarAccountMenu({
  avatarClassName = "h-8 w-8",
  buttonClassName,
  collapsed = false,
  dropdownAlign = "end",
  dropdownSide = "top",
  extraActions = [],
  fallbackEmail,
  fallbackInitials,
  fallbackName,
  showText = true,
  subtitle,
}: SidebarAccountMenuProps) {
  const router = useRouter()
  const { profile, signOut } = useAuth()
  const { messages } = useLocale()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const displayName = profile?.name ?? fallbackName ?? messages.shell.yeahBuddyUser
  const displayEmail = profile?.email ?? fallbackEmail ?? messages.shell.loadingEmail
  const fallbackDisplayInitials = fallbackInitials ?? (getInitials(displayName) || "YB")
  const initials = profile?.name ? getInitials(profile.name) || "YB" : fallbackDisplayInitials

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          suppressHydrationWarning
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center px-2",
            buttonClassName,
          )}
        >
          <Avatar className={avatarClassName}>
            <AvatarImage src={profile?.avatar ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-foreground font-mono text-[11px] font-semibold text-background">
              {initials}
            </AvatarFallback>
          </Avatar>
          {showText && !collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">{subtitle ?? displayEmail}</span>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={dropdownAlign} side={dropdownSide} className="w-56">
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
        {extraActions.map((action) => (
          <DropdownMenuItem key={action.href} asChild>
            <Link href={action.href}>
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleSignOut()} disabled={isSigningOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {isSigningOut ? messages.common.signingOut : messages.common.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
