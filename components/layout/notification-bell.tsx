"use client"

import { formatDistanceToNow } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import { ArrowRight, Bell, Check, CheckCheck, Loader2, RotateCcw, Settings, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { AppNotification } from "@/lib/fitness/types"
import type { AppMessages } from "@/lib/i18n/messages"
import { presentNotification, resolveNotificationHref } from "@/lib/notifications/present"
import { setAppBadge } from "@/lib/pwa/app-badge"
import { useApproveTraineeExerciseSwap, useRejectTraineeExerciseSwap } from "@/lib/queries/coach"
import {
  useClearNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/queries/notifications"
import { cn } from "@/lib/utils"

function formatBadge(count: number) {
  return count > 9 ? "9+" : String(count)
}

type SwapStatus = "approved" | "closed" | "pending" | "rejected" | "superseded"

/** Where a trainee's exercise swap request stands; null for any other notification. */
function readSwapStatus(notification: AppNotification): SwapStatus | null {
  const metadata = notification.metadata
  if (notification.type !== "general" || metadata?.kind !== "trainee_swapped_exercise") return null
  if (typeof metadata.approvedAt === "string") return "approved"
  // The trainee swapped the same exercise again; only the newest request counts.
  if (typeof metadata.supersededAt === "string") return "superseded"
  if (typeof metadata.rejectedAt === "string") {
    // Closed by the server because it could no longer be applied, not by the coach.
    return typeof metadata.rejectionReason === "string" ? "closed" : "rejected"
  }
  return "pending"
}

const SWAP_STATUS_CLASS: Record<SwapStatus, string> = {
  approved: "bg-success-soft text-success-text",
  closed: "bg-muted text-muted-foreground",
  pending: "bg-warning-soft text-warning-text",
  rejected: "bg-muted text-muted-foreground",
  superseded: "bg-muted text-muted-foreground",
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
  const clearNotifications = useClearNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const approveExerciseSwap = useApproveTraineeExerciseSwap()
  const rejectExerciseSwap = useRejectTraineeExerciseSwap()
  const [selectedSwap, setSelectedSwap] = useState<AppNotification | null>(null)
  const { toast } = useToast()
  // A refused approval or rejection must not look like it went through. The
  // request is refetched either way, and its row shows where it now stands.
  const reportSwapError = (error: Error) => {
    toast({ title: error.message, tone: "error" })
    setSelectedSwap(null)
  }

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
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={notifications.length === 0 || clearNotifications.isPending}
              onClick={() => clearNotifications.mutate()}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:text-muted-foreground/50"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {copy.reset}
            </button>
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
              const swapStatus = readSwapStatus(notification)

              return (
                <DropdownMenuItem
                  key={notification.id}
                  onSelect={() => {
                    if (swapStatus === "pending") {
                      handleSelect(notification, null)
                      setSelectedSwap(notification)
                    } else {
                      handleSelect(notification, view.href)
                    }
                  }}
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
                    <span className="flex items-center gap-2">
                      {swapStatus ? (
                        <span className={cn("rounded-sm px-1.5 py-0.5 text-micro font-medium", SWAP_STATUS_CLASS[swapStatus])}>
                          {copy.swapReview.status[swapStatus]}
                        </span>
                      ) : null}
                      <time
                        dateTime={notification.createdAt.toISOString()}
                        className="text-micro text-muted-foreground"
                      >
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true, locale: dateLocale })}
                      </time>
                    </span>
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

      <Dialog open={Boolean(selectedSwap)} onOpenChange={(nextOpen) => !nextOpen && setSelectedSwap(null)}>
        <DialogContent className="w-[min(92vw,32rem)] rounded-2xl">
          {selectedSwap ? (
            <SwapDetailDialog
              notification={selectedSwap}
              locale={locale}
              copy={copy.swapReview}
              onApprove={() => {
                approveExerciseSwap.mutate(selectedSwap.id, {
                  onError: reportSwapError,
                  onSuccess: (result) => {
                    if (!result.alreadyApproved) toast({ title: copy.swapReview.approved(result.updatedExerciseCount), tone: "success" })
                    setSelectedSwap(null)
                  },
                })
              }}
              onReject={() => {
                rejectExerciseSwap.mutate(selectedSwap.id, {
                  onError: reportSwapError,
                  onSuccess: () => {
                    toast({ title: copy.swapReview.rejected, tone: "success" })
                    setSelectedSwap(null)
                  },
                })
              }}
              onViewTrainee={(href) => {
                setSelectedSwap(null)
                setOpen(false)
                router.push(href)
              }}
              approving={approveExerciseSwap.isPending}
              rejecting={rejectExerciseSwap.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  )
}

/** 0 = Sunday, as programs store it; read as the locale's full weekday name. */
function formatWeekday(day: unknown, locale: string) {
  if (typeof day !== "number" || day < 0 || day > 6) return null
  // 2024-01-07 was a Sunday.
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long" }).format(new Date(Date.UTC(2024, 0, 7 + day)))
}

function SwapDetailDialog({
  approving,
  copy,
  locale,
  notification,
  onApprove,
  onReject,
  onViewTrainee,
  rejecting,
}: {
  approving: boolean
  copy: AppMessages["notificationCenter"]["swapReview"]
  locale: string
  notification: AppNotification
  onApprove: () => void
  onReject: () => void
  onViewTrainee: (href: string) => void
  rejecting: boolean
}) {
  const metadata = notification.metadata ?? {}
  const text = (key: string) => (typeof metadata[key] === "string" && metadata[key] ? (metadata[key] as string) : null)
  const from = text("oldExerciseName") ?? "—"
  const to = text("newExerciseName") ?? "—"
  const workoutName = text("workoutName")
  const weekIndex = typeof metadata.workoutWeekIndex === "number" ? metadata.workoutWeekIndex : null
  const day = formatWeekday(metadata.workoutScheduledDay, locale)
  const traineeHref = resolveNotificationHref(notification)
  const busy = approving || rejecting

  return (
    <>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description(text("traineeName") ?? "Trainee", text("programName"))}</DialogDescription>
      </DialogHeader>

      <div className="min-w-0 space-y-4">
        <div className="rounded-xl border border-border p-3">
          {workoutName ? (
            <p className="mb-2.5 text-xs text-muted-foreground">{copy.session(workoutName, weekIndex === null ? null : weekIndex + 1, day)}</p>
          ) : null}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground line-through decoration-muted-foreground/50">{from}</p>
            <ArrowRight className="size-4 shrink-0 self-center rotate-90 text-muted-foreground sm:rotate-0" aria-hidden="true" />
            <p className="min-w-0 flex-1 rounded-lg bg-primary-soft px-3 py-2 text-sm font-medium text-primary">{to}</p>
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="label-micro text-primary">{copy.ifApprove}</dt>
            <dd className="mt-1 text-muted-foreground">{copy.afterApprove(day, weekIndex === null ? null : weekIndex + 2, to)}</dd>
          </div>
          <div>
            <dt className="label-micro text-muted-foreground">{copy.ifReject}</dt>
            <dd className="mt-1 text-muted-foreground">{copy.afterReject(from)}</dd>
          </div>
        </dl>
      </div>

      <DialogFooter className="gap-2 sm:items-center">
        {traineeHref ? (
          <Button variant="ghost" className="sm:mr-auto" disabled={busy} onClick={() => onViewTrainee(traineeHref)}>
            {copy.viewTrainee}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onReject} disabled={busy}>
          {rejecting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          {copy.reject}
        </Button>
        <Button onClick={onApprove} disabled={busy}>
          {approving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {copy.approve}
        </Button>
      </DialogFooter>
    </>
  )
}
