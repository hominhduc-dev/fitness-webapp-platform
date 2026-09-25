"use client"

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"

/** Horizontal travel before a press becomes a slide. */
const DRAG_START_PX = 6
/** How long after a slide the click it ends with is ignored. */
const SUPPRESS_CLICK_MS = 400

type Box = { height: number; left: number; top: number; width: number }

/**
 * A segmented control whose active segment sits under a liquid-glass lens. The
 * lens slides to the next segment with a slight overshoot and a squish, and
 * with `onSlide` it follows a finger dragged along the control.
 *
 * Each segment element must carry `data-segment`. `children` receives the
 * index the lens is over (the drag target while sliding) so segments style
 * their text from it; the lens paints the active background itself.
 *
 * `columns` is for equal-width grids: the lens is then placed by CSS and is
 * right from the first server paint. Without it the lens measures the active
 * segment, which handles segments of any width and wrapped rows.
 */
export function GlassSegmented({
  activeIndex,
  children,
  className,
  columns,
  lensClassName,
  onClickCapture,
  onSlide,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  activeIndex: number
  children: (shownIndex: number) => ReactNode
  columns?: { count: number; gapPx: number }
  lensClassName?: string
  onSlide?: (index: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<Box | null>(null)
  // While a finger slides along the control: where the lens is, and the segment under it.
  const [drag, setDrag] = useState<{ index: number; left: number; width: number } | null>(null)
  const gesture = useRef<{ dragging: boolean; pointerId: number; startX: number } | null>(null)
  const suppressClickUntil = useRef(0)
  // Replays the squish each time the lens moves to another segment (not on load).
  const [lastIndex, setLastIndex] = useState(activeIndex)
  const [moves, setMoves] = useState(0)
  if (activeIndex !== lastIndex) {
    setLastIndex(activeIndex)
    if (lastIndex >= 0 && activeIndex >= 0) setMoves((value) => value + 1)
  }

  const segments = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-segment]") ?? [])

  useLayoutEffect(() => {
    if (columns) return
    const container = containerRef.current
    if (!container) return
    const place = () => {
      const segment = segments()[activeIndex]
      setMeasured(
        segment
          ? { height: segment.offsetHeight, left: segment.offsetLeft, top: segment.offsetTop, width: segment.offsetWidth }
          : null,
      )
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(container)
    return () => observer.disconnect()
  }, [activeIndex, columns])

  /** The segment under `clientX` and a lens of its width centred on the finger. */
  const measureDrag = (clientX: number) => {
    const container = containerRef.current
    const items = segments()
    if (!container || items.length === 0) return null
    const origin = container.getBoundingClientRect().left
    const x = clientX - origin
    const boxes = items.map((item) => ({ left: item.offsetLeft, width: item.offsetWidth }))
    let index = boxes.findIndex((box) => x < box.left + box.width)
    if (index < 0) index = boxes.length - 1
    const { width } = boxes[index]
    const first = boxes[0].left
    const last = boxes[boxes.length - 1].left + boxes[boxes.length - 1].width
    return { index, left: Math.min(last - width, Math.max(first, x - width / 2)), width }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSlide || !event.isPrimary || event.button !== 0) return
    gesture.current = { dragging: false, pointerId: event.pointerId, startX: event.clientX }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    if (!current.dragging) {
      if (Math.abs(event.clientX - current.startX) < DRAG_START_PX) return
      current.dragging = true
      try {
        ;(event.target as Element).setPointerCapture(event.pointerId)
      } catch {
        // Pointer already gone: the slide still ends on pointerup/cancel.
      }
    }
    setDrag(measureDrag(event.clientX))
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    gesture.current = null
    if (!current || current.pointerId !== event.pointerId || !current.dragging) return
    const target = measureDrag(event.clientX)
    setDrag(null)
    // The press ends in a click on the segment it started on; that one is not the choice.
    suppressClickUntil.current = performance.now() + SUPPRESS_CLICK_MS
    if (target) onSlide?.(target.index)
  }

  const shownIndex = drag ? drag.index : activeIndex
  const verticalBox = columns ? { bottom: 0, top: 0 } : { height: measured?.height ?? 0, top: measured?.top ?? 0 }
  let lensStyle: CSSProperties
  if (drag) {
    lensStyle = { ...verticalBox, left: `${drag.left}px`, width: `${drag.width}px` }
  } else if (columns) {
    const column = `((100% - ${(columns.count - 1) * columns.gapPx}px) / ${columns.count})`
    lensStyle = { ...verticalBox, left: `calc(${Math.max(activeIndex, 0)} * (${column} + ${columns.gapPx}px))`, width: `calc(${column})` }
  } else {
    lensStyle = { ...verticalBox, left: `${measured?.left ?? 0}px`, width: `${measured?.width ?? 0}px` }
  }
  const placed = Boolean(columns || measured)
  // Transitions start a frame after the lens first has a place; from the first
  // measure they would slide it in from the corner.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!placed || settled) return
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [placed, settled])

  return (
    <div
      {...props}
      ref={containerRef}
      className={cn("relative [&_[data-segment]]:relative [&_[data-segment]]:z-10", onSlide && "touch-pan-y", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        gesture.current = null
        setDrag(null)
      }}
      onClickCapture={(event) => {
        if (performance.now() < suppressClickUntil.current) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        onClickCapture?.(event)
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute z-0",
          !drag && settled && "transition-[left,top,width,height,opacity] duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)] motion-reduce:transition-none",
          shownIndex < 0 || !placed ? "opacity-0" : "opacity-100",
        )}
        style={lensStyle}
      >
        <span
          key={moves}
          className={cn(
            "glass-lens block size-full transition-transform duration-200",
            lensClassName,
            drag ? "scale-[1.06]" : moves > 0 && "animate-[glass-lens-squish_460ms_ease-out] motion-reduce:animate-none",
          )}
        />
      </span>
      {children(shownIndex)}
    </div>
  )
}
