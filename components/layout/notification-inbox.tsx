"use client"

import { formatDistanceToNow } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import { Bell, CheckCheck, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/fitness/api"
import type { AppNotification } from "@/lib/fitness/types"
import { getRoleLandingPath } from "@/lib/auth/roles"

type NotificationInboxProps = {
  locale?: "en" | "vi"
}

function getNotificationHref(notification: AppNotification, role?: "admin" | "coach" | "trainee") {
  const traineeId = typeof notification.metadata?.traineeId === "string" ? notification.metadata.traineeId : undefined

  if (role === "coach" && traineeId) {
    return `/coach/trainees/${traineeId}`
  }

  if (role === "coach") {
    return "/coach"
  }

  if (role === "trainee" && notification.type === "program_assigned") {
    return "/workout"
  }

  return getRoleLandingPath(role)
}

export function NotificationInbox({ locale = "vi" }: NotificationInboxProps) {
  const router = useRouter()
  const { profile, session } = useAuth()
  const [isMounted, setIsMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!session?.access_token) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    let cancelled = false

    const loadNotifications = async (showLoading = false) => {
      if (showLoading) {
        setIsLoading(true)
      }

      try {
        const response = await fetchNotifications(session.access_token, 12)

        if (cancelled) {
          return
        }

        setNotifications(response.notifications)
        setUnreadCount(response.unreadCount)
        setError(null)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : locale === "en" ? "Unable to load notifications." : "Không thể tải notification.")
        }
      } finally {
        if (!cancelled && showLoading) {
          setIsLoading(false)
        }
      }
    }

    void loadNotifications(true)
    const intervalId = window.setInterval(() => {
      void loadNotifications(false)
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [locale, session?.access_token])

  useEffect(() => {
    if (!isOpen || !session?.access_token) {
      return
    }

    void (async () => {
      setIsLoading(true)

      try {
        const response = await fetchNotifications(session.access_token, 12)
        setNotifications(response.notifications)
        setUnreadCount(response.unreadCount)
        setError(null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : locale === "en" ? "Unable to load notifications." : "Không thể tải notification.")
      } finally {
        setIsLoading(false)
      }
    })()
  }, [isOpen, locale, session?.access_token])

  const handleOpenNotification = async (notification: AppNotification) => {
    if (!session?.access_token) {
      return
    }

    try {
      if (!notification.readAt) {
        const updated = await markNotificationRead(session.access_token, notification.id)
        setNotifications((current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry)),
        )
        setUnreadCount((current) => Math.max(0, current - 1))
      }
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : locale === "en" ? "Unable to update notification." : "Không thể cập nhật notification.")
    }

    setIsOpen(false)
    router.push(getNotificationHref(notification, profile?.role))
    router.refresh()
  }

  const handleMarkAllRead = async () => {
    if (!session?.access_token || unreadCount === 0) {
      return
    }

    setIsMarkingAll(true)

    try {
      await markAllNotificationsRead(session.access_token)
      setNotifications((current) =>
        current.map((notification) =>
          notification.readAt ? notification : { ...notification, readAt: new Date() },
        ),
      )
      setUnreadCount(0)
      setError(null)
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : locale === "en" ? "Unable to update notifications." : "Không thể cập nhật notification.")
    } finally {
      setIsMarkingAll(false)
    }
  }

  const triggerButton = (
    <Button variant="ghost" size="icon" className="relative inline-flex h-10 w-10 rounded-full" disabled={!isMounted}>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 ? (
        <>
          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary" />
        </>
      ) : null}
    </Button>
  )

  if (!isMounted) {
    return triggerButton
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <div className="p-2">
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <DropdownMenuLabel className="p-0">
              {locale === "en" ? "Notifications" : "Thông báo"}
            </DropdownMenuLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0 || isMarkingAll}
            >
              {isMarkingAll ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1 h-3.5 w-3.5" />}
              {locale === "en" ? "Mark all read" : "Đánh dấu đã đọc"}
            </Button>
          </div>

          <DropdownMenuSeparator />

          {error ? (
            <div className="px-2 py-3 text-sm text-destructive">{error}</div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 px-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {locale === "en" ? "Loading notifications..." : "Đang tải thông báo..."}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {locale === "en" ? "No notifications yet." : "Chưa có thông báo nào."}
            </div>
          ) : (
            <div className="max-h-[420px] space-y-1 overflow-y-auto px-1 py-2">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleOpenNotification(notification)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                    notification.readAt
                      ? "border-transparent bg-muted/35 hover:border-border hover:bg-muted/55"
                      : "border-primary/20 bg-primary/5 hover:border-primary/30 hover:bg-primary/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                    {!notification.readAt ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(notification.createdAt, {
                      addSuffix: true,
                      locale: locale === "en" ? enUS : vi,
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
