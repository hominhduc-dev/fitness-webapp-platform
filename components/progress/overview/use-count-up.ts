"use client"

import { useEffect, useState } from "react"

const DURATION_MS = 700

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
}

/**
 * Counts from 0 up to `target` once it is known, easing out. Under reduced
 * motion, or before the first paint on the server, it is simply `target`.
 */
export function useCountUp(target: number | null) {
  const [value, setValue] = useState(target ?? 0)

  useEffect(() => {
    if (target == null) return

    // Reduced motion lands on the target in the first frame instead of counting.
    const duration = prefersReducedMotion() ? 0 : DURATION_MS
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      setValue(target * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return value
}
