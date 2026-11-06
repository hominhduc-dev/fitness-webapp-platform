import { cn } from "@/lib/utils"
import { parseSetTempo, repTutSeconds } from "@/lib/workout/set-tempo"

/**
 * The trainee-facing surface of a prescribed cadence: a short badge beside the
 * set number, the same place the method badge sits.
 *
 * The hyphens are dropped so the badge stays four glyphs wide — at 375px the
 * set-number column has no room for "3-1-1-0" — and the full cadence, with what
 * each number means, is in the title for anyone who needs it spelled out.
 */
export function SetTempoBadge({
  className,
  label,
  tempo,
}: {
  className?: string
  /** Localized "eccentric · pause · concentric · pause, N seconds a rep" text. */
  label: (tempo: string, seconds: number) => string
  tempo: string | undefined
}) {
  const parsed = parseSetTempo(tempo)
  if (!parsed) return null

  const seconds = repTutSeconds(parsed)

  return (
    <span
      className={cn(
        "rounded-full bg-muted px-1.5 py-px font-mono text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted-foreground",
        className,
      )}
      title={seconds == null ? parsed : label(parsed, seconds)}
    >
      {parsed.split("-").join("")}
    </span>
  )
}
