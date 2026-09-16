"use client"

import { useEffect } from "react"

import { registerServiceWorker } from "@/lib/offline/service-worker"

/**
 * Registers the worker that caches the app shell for offline startup.
 *
 * Production only: under `next dev` a cache-first worker would keep serving
 * chunks HMR has already replaced. Web Push still registers on demand in dev.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return

    const register = () => {
      void registerServiceWorker().catch(() => undefined)
    }

    // Wait for load so the worker's precache doesn't compete with first paint.
    if (document.readyState === "complete") {
      register()
      return
    }

    window.addEventListener("load", register, { once: true })
    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
