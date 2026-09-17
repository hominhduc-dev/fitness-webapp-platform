"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { ApiError } from "@/lib/auth/api"
import { markNotificationRead } from "@/lib/fitness/api"
import { syncCurrentPushSubscription } from "@/lib/push-notifications"
import { queryKeys } from "@/lib/queries/keys"

const NOTIFICATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function notificationIdFromUrl() {
  const url = new URL(window.location.href)
  return { id: url.searchParams.get("pushNotification"), url }
}

function removeNotificationIdFromUrl(url: URL) {
  url.searchParams.delete("pushNotification")
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
}

/**
 * Rebinds an existing browser endpoint whenever the signed-in account or device
 * locale changes. This is intentionally global: visiting Settings must not be a
 * prerequisite for preventing a previous account from owning this endpoint.
 */
export function PushSubscriptionAccountSync() {
  const queryClient = useQueryClient()
  const { locale } = useLocale()
  const { session } = useAuth()

  useEffect(() => {
    const accessToken = session?.access_token
    if (!accessToken) return

    const sync = () => {
      void syncCurrentPushSubscription(accessToken, locale).catch((error) => {
        console.warn("Unable to synchronize push subscription", error)
      })
    }

    sync()

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") sync()
    }
    navigator.serviceWorker?.addEventListener("message", handleMessage)

    return () => navigator.serviceWorker?.removeEventListener("message", handleMessage)
  }, [locale, session?.access_token])

  useEffect(() => {
    const accessToken = session?.access_token
    if (!accessToken) return
    let running = false

    const markPushNotificationRead = async () => {
      if (running) return
      const { id, url } = notificationIdFromUrl()
      if (!id) return
      if (!NOTIFICATION_ID_PATTERN.test(id)) {
        removeNotificationIdFromUrl(url)
        return
      }

      running = true
      try {
        await markNotificationRead(accessToken, id)
        removeNotificationIdFromUrl(url)
        await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) removeNotificationIdFromUrl(url)
        // Retryable failures keep the id in the URL for reconnect/reload.
        console.warn("Unable to mark push notification as read", error)
      } finally {
        running = false
      }
    }

    void markPushNotificationRead()
    window.addEventListener("online", markPushNotificationRead)
    return () => window.removeEventListener("online", markPushNotificationRead)
  }, [queryClient, session?.access_token])

  return null
}
