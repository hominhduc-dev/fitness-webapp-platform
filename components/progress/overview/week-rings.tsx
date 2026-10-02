"use client"

import { useEffect, useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { formatReadinessScore } from "@/lib/fitness/readiness"
import { cn } from "@/lib/utils"

type Ring = {
  color: string
  key: string
  label: string
  /** 0–1, how far round the ring is filled. */
  progress: number
  value: string
}

// Sized so the innermost ring still leaves room for the readiness label.
const SIZE = 148
const STROKE = 9
const GAP = 3

/**
 * Three concentric progress rings for the week — sessions against the plan,
 * muscles inside their productive range, sleep against seven hours — with
 * today's readiness in the middle. Each ring is labelled beside the figure, so
 * colour never carries the meaning alone.
 */
export function WeekRings({ readiness, rings }: { readiness: number | null; rings: Ring[] }) {
  const { messages } = useLocale()
  // Rings draw in from empty on mount; the transition is off under reduced motion via CSS.
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className="relative shrink-0" style={{ height: SIZE, width: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90" aria-hidden="true">
          {rings.map((ring, index) => {
            const radius = SIZE / 2 - STROKE / 2 - index * (STROKE + GAP)
            const circumference = 2 * Math.PI * radius
            const progress = Math.max(0, Math.min(1, ring.progress))
            return (
              <g key={ring.key} style={{ color: ring.color }}>
                <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={STROKE} />
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - (drawn ? progress : 0))}
                  strokeLinecap="round"
                  strokeWidth={STROKE}
                  className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
                  style={{ transitionDelay: `${index * 120}ms` }}
                />
              </g>
            )
          })}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold leading-none text-foreground">{formatReadinessScore(readiness)}</span>
          <span className="mt-1 text-[10px] leading-none text-muted-foreground">{messages.progressPage.overview.rings.readiness}</span>
        </span>
      </div>

      <dl className="min-w-0 flex-1 space-y-2.5">
        {rings.map((ring) => (
          <div key={ring.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ background: ring.color }} aria-hidden="true" />
              <span className="truncate">{ring.label}</span>
            </dt>
            <dd className={cn("mt-0.5 truncate text-base font-semibold text-foreground")}>{ring.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
