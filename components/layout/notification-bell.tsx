"use client"

import { formatDistanceToNow } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import { Bell, Check, CheckCheck, Loader2, Settings } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import type { AppNotification } from "@/lib/fitness/types"
import { presentNotification } from "@/lib/notifications/present"
import { setAppBadge } from "@/lib/pwa/app-badge"
import { useApproveTraineeExerciseSwap } from "@/lib/queries/coach"
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/lib/queries/notifications"
import { cn } from "@/lib/utils"

function formatBadge(count: number) {
  return count > 9 ? "9+" : String(count)
}

function isPendingExerciseSwapApproval(notification: AppNotification) {
  return notification.type === "general" &&
    notification.metadata?.kind === "trainee_swapped_exercise" &&
    typeof notification.metadata?.approvedAt !== "string"
}

/**
 * The bell and its dropdown, shared by every role. Rows are rendered only while the
 * menu is open, so relative times ("5 minutes ago") are computed on the client
 * and never cause a hydration mismatch.
 */
export function NotificationBell({
  align = "end",
  className,
  side = "bottom",
}: {
  align?: "center" | "end" | "start"
  className?: string
  side?: "bottom" | "right"
}) {
  const { locale, messages } = useLocale()
  const copy = messages.notificationCenter
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const query = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const approveExerciseSwap = useApproveTraineeExerciseSwap()

  const notifications = query.data?.notifications ?? []
  const unreadCount = query.data?.unreadCount ?? 0
  const now = new Date()
  const dateLocale = locale === "vi" ? vi : enUS

  useEffect(() => {
    if (query.data) void setAppBadge(unreadCount)
  }, [query.data, unreadCount])

  const handleSelect = (notification: AppNotification, href: string | null) => {
    if (!notification.readAt) markRead.mutate(notification.id)
    if (href) router.push(href)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={copy.open(unreadCount)}
        className={cn(
          "relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground",
          className,
        )}
      >
        <Bell className="size-5" strokeWidth={1.7} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-micro font-semibold leading-none text-destructive-foreground ring-2 ring-background"
          >
            {formatBadge(unreadCount)}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={16}
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border-border bg-card p-0"
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <button
            type="button"
            disabled={unreadCount === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:text-muted-foreground"
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            {copy.markAllRead}
          </button>
        </div>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[min(28rem,60dvh)] overflow-y-auto p-1.5">
          {query.isError && notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{copy.loadError}</p>
          ) : query.isPending ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <Bell className="mb-1 size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">{copy.empty}</p>
              <p className="text-xs text-muted-foreground">{copy.emptyCopy}</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const view = presentNotification(notification, messages, locale, now)
              const unread = !notification.readAt
              const canApproveSwap = isPendingExerciseSwapApproval(notification)
              const isApprovingSwap =
                approveExerciseSwap.isPending && approveExerciseSwap.variables === notification.id

              return (
                <DropdownMenuItem
                  key={notification.id}
                  onSelect={() => handleSelect(notification, view.href)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5",
                    unread && "bg-primary-soft/40",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn("text-sm text-foreground", unread ? "font-semibold" : "font-medium")}>
                      {unread ? <span className="sr-only">{copy.unread}: </span> : null}
                      {view.title}
                    </span>
                    <span className="line-clamp-3 text-xs text-muted-foreground">{view.message}</span>
                    {canApproveSwap ? (
                      <button
                        type="button"
                        disabled={isApprovingSwap}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          approveExerciseSwap.mutate(notification.id)
                        }}
                        className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/30 bg-primary-soft px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft/80 disabled:pointer-events-none disabled:opacity-70"
                      >
                        {isApprovingSwap ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="size-3" aria-hidden="true" />
                        )}
                        {locale === "vi" ? "Duyệt đổi bài" : "Approve swap"}
                      </button>
                    ) : null}
                    <time
                      dateTime={notification.createdAt.toISOString()}
                      className="text-micro text-muted-foreground"
                    >
                      {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: dateLocale })}
                    </time>
                  </span>
                </DropdownMenuItem>
              )
            })
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="m-1.5 cursor-pointer justify-center rounded-xl py-2 text-xs font-medium text-muted-foreground">
          <Link href="/profile#settings-notifications">
            <Settings className="size-3.5" aria-hidden="true" />
            {copy.settings}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
