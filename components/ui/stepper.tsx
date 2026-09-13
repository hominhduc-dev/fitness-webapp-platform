import { Check } from "lucide-react"
import { Fragment } from "react"

import { cn } from "@/lib/utils"

export type StepperStep<T extends string = string> = { label: string; value: T }

/**
 * Numbered progress for a linear flow. Steps before `current` show a check,
 * the current step is highlighted, later steps stay muted.
 */
export function Stepper<T extends string>({
  className,
  current,
  steps,
}: {
  className?: string
  current: T
  steps: ReadonlyArray<StepperStep<T>>
}) {
  const currentIndex = steps.findIndex((step) => step.value === current)

  return (
    <ol className={cn("flex items-center gap-2 overflow-x-auto sm:gap-3", className)}>
      {steps.map((step, index) => {
        const complete = index < currentIndex
        const active = index === currentIndex

        return (
          <Fragment key={step.value}>
            {index > 0 ? (
              <li
                aria-hidden="true"
                className={cn("h-px w-6 shrink-0 sm:w-12", index <= currentIndex ? "bg-primary/40" : "bg-border")}
              />
            ) : null}
            <li aria-current={active ? "step" : undefined} className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full font-mono text-xs font-semibold tnum sm:size-8 sm:text-sm",
                  active || complete ? "bg-primary text-primary-foreground" : "bg-surface-subtle text-muted-foreground",
                )}
              >
                {complete ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "font-mono text-xs uppercase tracking-[0.08em]",
                  active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
