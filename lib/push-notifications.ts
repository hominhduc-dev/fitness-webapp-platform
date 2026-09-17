"use client"

import { useCallback, useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import {
  deletePushSubscription,
  fetchPushConfig,
  savePushSubscription,
  sendTestPush,
} from "@/lib/fitness/api"
import type { AppLocale } from "@/lib/i18n/config"
import { getPushCapability, hasWebPushApis } from "@/lib/pwa/push-support"
import { requireAccessToken } from "@/lib/queries/token"

type PushSupportState = "checking" | "disabled" | "denied" | "granted" | "ios_install_required" | "unsupported"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/")
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" })
}

async function getCurrentPushSubscription() {
  if (!hasWebPushApis()) return null
  const registration = await navigator.serviceWorker.getRegistration("/")
  return registration?.pushManager.getSubscription() ?? null
}

/** Reassigns the browser endpoint to the active account without prompting. */
async function syncCurrentPushSubscription(accessToken: string, locale: AppLocale) {
  if (getPushCapability() !== "supported" || Notification.permission !== "granted") return false

  const subscription = await getCurrentPushSubscription()
  if (!subscription) return false

  await savePushSubscription(accessToken, subscription.toJSON(), locale)
  return true
}

/** Revokes server ownership before auth is cleared; the endpoint stays reusable by the next account. */
async function revokeCurrentPushSubscription(accessToken: string) {
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return false

  try {
    await deletePushSubscription(accessToken, subscription.endpoint)
  } catch (error) {
    // If logout happens while the API is unavailable, invalidate the browser
    // endpoint locally. The server will receive 404/410 and revoke its stale row.
    await subscription.unsubscribe()
    throw error
  }
  return true
}

export function usePushNotifications() {
  const { locale } = useLocale()
  const [enabled, setEnabled] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [state, setState] = useState<PushSupportState>("checking")

  const refresh = useCallback(async () => {
    const capability = getPushCapability()
    if (capability !== "supported") {
      setEnabled(false)
      setState(capability)
      return
    }

    if (Notification.permission === "denied") {
      setEnabled(false)
      setState("denied")
      return
    }

    const registration = await navigator.serviceWorker.getRegistration("/")
    const subscription = await registration?.pushManager.getSubscription()
    setEnabled(Boolean(subscription))
    setState(Notification.permission === "granted" ? "granted" : "disabled")
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void refresh()
    })
    return () => {
      active = false
    }
  }, [refresh])

  const subscribe = useCallback(async () => {
    setIsBusy(true)
    try {
      const capability = getPushCapability()
      if (capability !== "supported") {
        setState(capability)
        throw new Error(
          capability === "ios_install_required"
            ? "Hãy thêm YeahBuddy vào Màn hình chính rồi mở app từ icon để bật thông báo."
            : "Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.",
        )
      }

      const config = await fetchPushConfig()
      if (!config.enabled || !config.publicKey) {
        setState("disabled")
        throw new Error("Server chưa cấu hình VAPID key cho push notification.")
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled")
        throw new Error("Bạn chưa cấp quyền nhận thông báo.")
      }

      const registration = await getServiceWorkerRegistration()
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        userVisibleOnly: true,
      })

      await savePushSubscription(await requireAccessToken(), subscription.toJSON(), locale)
      setEnabled(true)
      setState("granted")
    } finally {
      setIsBusy(false)
    }
  }, [locale])

  const unsubscribe = useCallback(async () => {
    setIsBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration("/")
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await deletePushSubscription(await requireAccessToken(), subscription.endpoint)
        await subscription.unsubscribe()
      }
      setEnabled(false)
      setState(Notification.permission === "denied" ? "denied" : "disabled")
    } finally {
      setIsBusy(false)
    }
  }, [])

  const sendTest = useCallback(async () => {
    setIsBusy(true)
    try {
      return await sendTestPush(await requireAccessToken())
    } finally {
      setIsBusy(false)
    }
  }, [])

  return {
    enabled,
    isBusy,
    refresh,
    sendTest,
    state,
    subscribe,
    unsubscribe,
  }
}

export { revokeCurrentPushSubscription, syncCurrentPushSubscription }
export type { PushSupportState }
