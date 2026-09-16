"use client"

import { useCallback, useEffect, useState } from "react"

import {
  deletePushSubscription,
  fetchPushConfig,
  savePushSubscription,
  sendTestPush,
} from "@/lib/fitness/api"
import { requireAccessToken } from "@/lib/queries/token"

type PushSupportState = "checking" | "disabled" | "denied" | "granted" | "unsupported"

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

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/")
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" })
}

export function usePushNotifications() {
  const [enabled, setEnabled] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [state, setState] = useState<PushSupportState>("checking")

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setEnabled(false)
      setState("unsupported")
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
    void refresh()
  }, [refresh])

  const subscribe = useCallback(async () => {
    setIsBusy(true)
    try {
      if (!isPushSupported()) {
        setState("unsupported")
        throw new Error("Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.")
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

      await savePushSubscription(await requireAccessToken(), subscription.toJSON())
      setEnabled(true)
      setState("granted")
    } finally {
      setIsBusy(false)
    }
  }, [])

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
