import type { ComponentProps, ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** The shared `Input` with a decorative leading icon. */
export function InputWithIcon({
  className,
  icon,
  ...props
}: ComponentProps<typeof Input> & { icon: ReactNode }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4"
      >
        {icon}
      </span>
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  )
}
