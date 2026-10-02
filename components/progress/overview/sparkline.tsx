import { sparklinePath } from "@/lib/fitness/progress-overview"

const WIDTH = 96
const HEIGHT = 28

/**
 * A single-series trend line for a stat tile. Decorative: the tile states the
 * value and the change in text, so the line is hidden from assistive tech.
 */
export function Sparkline({ className, values }: { className?: string; values: readonly number[] }) {
  if (values.length < 2) return null
  const path = sparklinePath(values, WIDTH, HEIGHT)
  const lastY = path.split(",").at(-1)

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={WIDTH} cy={Number(lastY)} r={2.5} fill="currentColor" />
    </svg>
  )
}
