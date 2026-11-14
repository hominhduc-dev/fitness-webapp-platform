export type QuickActionKey = "analyze" | "progress" | "deload" | "note" | "review" | "plateau"

export type QuickActionInput = {
  role: "trainee" | "coach" | "admin" | undefined
  /** Coach picked a trainee (trainees always act on themselves). */
  hasSubject: boolean
  /** A program is selected, so proposal actions have a concrete target. */
  hasProgram: boolean
}

/**
 * Which one-tap actions to show above the composer, in display order.
 * Proposal actions (progress/deload) need a program; note drafting is coach-only and needs a trainee.
 */
export function quickActions({ role, hasSubject, hasProgram }: QuickActionInput): QuickActionKey[] {
  if (role === "coach") {
    // Without a trainee, per-person analysis would force the agent to guess; only the roster review makes sense.
    if (!hasSubject) return ["review"]
    return hasProgram ? ["progress", "analyze", "deload", "note"] : ["analyze", "plateau", "note"]
  }
  if (role === "trainee") return hasProgram ? ["analyze", "progress", "plateau", "deload"] : ["analyze", "plateau"]
  return []
}
