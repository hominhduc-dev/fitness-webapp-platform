"use client"

import { useEffect, type RefObject } from "react"
import type { GlassConfig, LiquidGlass as LiquidGlassInstance } from "@ybouane/liquidglass"

type LiquidGlassConfig = Partial<GlassConfig>

/**
 * Enhances one existing surface with the WebGL renderer. The target must be a
 * direct child of its parent because the library composites that parent's
 * other children to reconstruct the scene behind the glass.
 */
export function useLiquidGlass(
  ref: RefObject<HTMLElement | null>,
  config: LiquidGlassConfig,
  renderKey?: string,
) {
  const serializedConfig = JSON.stringify(config)

  useEffect(() => {
    const element = ref.current
    const root = element?.parentElement

    if (!element || !root || element.parentElement !== root) return
    if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) return

    let cancelled = false
    let starting = false
    let instance: LiquidGlassInstance | null = null
    const previousConfig = element.dataset.config

    element.dataset.config = serializedConfig

    const start = () => {
      if (cancelled || starting || instance || element.offsetWidth === 0 || element.offsetHeight === 0) return
      starting = true

      void import("@ybouane/liquidglass")
        .then(async ({ LiquidGlass }) => {
          if (cancelled || !element.isConnected || element.parentElement !== root) return

          instance = await LiquidGlass.init({ root, glassElements: [element] })
          if (cancelled) {
            instance.destroy()
            return
          }

          element.dataset.liquidGlassRenderer = "webgl"
        })
        .catch((error: unknown) => {
          // CSS glass remains the fallback. Keep this warning actionable without
          // breaking navigation when WebGL, canvas capture, or CORS is blocked.
          console.warn("Liquid glass WebGL enhancement was unavailable.", error)
        })
        .finally(() => {
          starting = false
        })
    }

    const resizeObserver = new ResizeObserver(start)
    resizeObserver.observe(element)
    start()

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      instance?.destroy()
      delete element.dataset.liquidGlassRenderer
      if (previousConfig === undefined) delete element.dataset.config
      else element.dataset.config = previousConfig
    }
  }, [ref, renderKey, serializedConfig])
}
