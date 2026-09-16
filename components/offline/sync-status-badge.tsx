"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Check, CloudOff, RefreshCw } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { retryFailedOfflineMutations } from "@/lib/offline/sync"
import { useOfflineSyncStatus } from "@/lib/offline/use-offline-sync-status"
import { cn } from "@/lib/utils"

/** How long "Synced" stays up after the queue drains. */
const SYNCED_VISIBLE_MS = 3_000

const pillClassName =
  "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium [&>svg]:size-3.5"

/**
 * Offline / Syncing / Synced / Sync failed. Renders nothing while online with
 * an empty queue, so it can sit in a header permanently.
 */
export function SyncStatusBadge({ className }: { className?: string }) {
  const { messages } = useLocale()
  const copy = messages.offlineSync
  const { profile } = useAuth()
  const { failed, hasBacklog, isOnline, isSyncing, lastSyncedAt, pending } = useOfflineSyncStatus()
  // The sync status outlives this component, so a remount can see a drain that
  // finished long ago; the timer runs for whatever is left of the window.
  const [expiredSyncAt, setExpiredSyncAt] = useState<number | null>(null)

  useEffect(() => {
    if (!lastSyncedAt) return
    const remainingMs = Math.max(0, SYNCED_VISIBLE_MS - (Date.now() - lastSyncedAt))
    const timeoutId = window.setTimeout(() => setExpiredSyncAt(lastSyncedAt), remainingMs)
    return () => window.clearTimeout(timeoutId)
  }, [lastSyncedAt])

  if (!isOnline) {
    return (
      <span role="status" className={cn(pillClassName, "bg-muted text-muted-foreground", className)}>
        <CloudOff aria-hidden />
        {pending > 0 ? copy.offlinePending(pending) : copy.offline}
      </span>
    )
  }

  if (failed > 0 && !isSyncing) {
    return (
      <button
        type="button"
        title={copy.syncFailedDetail(failed)}
        aria-label={`${copy.syncFailed}. ${copy.retrySync}`}
        onClick={() => {
          if (profile?.id) void retryFailedOfflineMutations(profile.id)
        }}
        className={cn(pillClassName, "bg-destructive-soft text-destructive-text hover:opacity-90 pointer-coarse:min-h-11", className)}
      >
        <AlertTriangle aria-hidden />
        {copy.syncFailed}
      </button>
    )
  }

  if (isSyncing || (hasBacklog && pending > 0)) {
    return (
      <span role="status" className={cn(pillClassName, "bg-info-soft text-info-text", className)}>
        <RefreshCw aria-hidden className={cn(isSyncing && "motion-safe:animate-spin")} />
        {copy.syncing}
      </span>
    )
  }

  if (lastSyncedAt && expiredSyncAt !== lastSyncedAt) {
    return (
      <span role="status" className={cn(pillClassName, "bg-success-soft text-success-text", className)}>
        <Check aria-hidden />
        {copy.synced}
      </span>
    )
  }

  return null
}
