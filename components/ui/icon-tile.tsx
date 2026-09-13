import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-8 rounded-md [&_svg]:size-4",
  md: "size-10 rounded-lg [&_svg]:size-5",
  lg: "size-12 rounded-full [&_svg]:size-6",
} as const

const TONES = {
  neutral: "bg-surface-subtle text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  surface: "border border-border bg-card text-foreground",
} as const

/**
 * A square or round tile that frames a single icon: the leading visual of list
 * rows, disclosure headers and account rows. Decorative, so hidden from AT.
 */
export function IconTile({
  children,
  className,
  size = "md",
  tone = "neutral",
}: {
  children: ReactNode
  className?: string
  size?: keyof typeof SIZES
  tone?: keyof typeof TONES
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center", SIZES[size], TONES[tone], className)}
    >
      {children}
    </span>
  )
}
