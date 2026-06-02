"use client"

import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react"

import { cn } from "@/lib/utils"

const THRESHOLD = 72 // px pulled (after resistance) needed to trigger a refresh
const MAX_PULL = 120 // px — visual cap so the spinner never flies off
const RESISTANCE = 0.5 // finger travel → visual travel (rubber-band feel)

interface PullToRefreshProps {
  children: ReactNode
  /**
   * Custom refresh handler. If omitted, falls back to `router.refresh()`
   * (re-fetches server components — ideal for the SSR `force-dynamic` pages).
   * Pass an async fn on CSR pages to re-run their client-side fetch.
   */
  onRefresh?: () => Promise<void> | void
  className?: string
}

/**
 * Touch-only pull-to-refresh. iOS standalone PWAs lose Safari's native
 * pull-to-refresh, so we rebuild it. Only arms when the active scroll
 * container is already at the top; on desktop (no touch events) it's inert.
 */
export function PullToRefresh({ children, onRefresh, className }: PullToRefreshProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)

  const refreshing = busy || isPending
  const refreshingRef = useRef(refreshing)
  refreshingRef.current = refreshing

  const wrapRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)

  // When a refresh cycle ends, settle the indicator back to rest.
  useEffect(() => {
    if (!refreshing) {
      pullRef.current = 0
      setPull(0)
    }
  }, [refreshing])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    // Scroll offset of the nearest scrollable ancestor (handles both
    // document-scroll and an inner `overflow-auto` container).
    const scrollTopOf = (node: EventTarget | null): number => {
      let cur = node as HTMLElement | null
      while (cur && cur.nodeType === 1 && cur !== document.body) {
        const oy = getComputedStyle(cur).overflowY
        if ((oy === "auto" || oy === "scroll") && cur.scrollHeight > cur.clientHeight + 1) {
          return cur.scrollTop
        }
        cur = cur.parentElement
      }
      return window.scrollY || document.documentElement.scrollTop || 0
    }

    const run = async () => {
      if (onRefresh) {
        setBusy(true)
        try {
          await onRefresh()
        } finally {
          setBusy(false)
        }
      } else {
        // isPending stays true until the server components finish refetching.
        startTransition(() => router.refresh())
      }
    }

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return
      startY.current = scrollTopOf(e.target) <= 0 ? e.touches[0].clientY : null
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || refreshingRef.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0
          setPull(0)
          setDragging(false)
        }
        return
      }
      const dist = Math.min(MAX_PULL, dy * RESISTANCE)
      pullRef.current = dist
      setPull(dist)
      setDragging(true)
      if (dist > 4 && e.cancelable) e.preventDefault() // suppress native bounce
    }

    const onEnd = () => {
      if (startY.current === null) return
      const triggered = pullRef.current >= THRESHOLD
      startY.current = null
      setDragging(false)
      if (triggered) {
        pullRef.current = THRESHOLD
        setPull(THRESHOLD)
        void run()
      } else {
        pullRef.current = 0
        setPull(0)
      }
    }

    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd, { passive: true })
    el.addEventListener("touchcancel", onEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh, router])

  const visualPull = refreshing ? THRESHOLD : pull
  const progress = Math.min(1, visualPull / THRESHOLD)

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center"
        style={{
          top: "env(safe-area-inset-top)",
          transform: `translateY(${visualPull - 44}px)`,
          opacity: visualPull > 4 ? 1 : 0,
          transition: dragging ? "none" : "transform .25s ease, opacity .2s ease",
        }}
      >
        <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background shadow-md">
          <RefreshCw
            className={cn("h-4 w-4 text-primary", refreshing && "animate-spin")}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
              opacity: 0.5 + progress * 0.5,
            }}
          />
        </div>
      </div>

      {children}
    </div>
  )
}
