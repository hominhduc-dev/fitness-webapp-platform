/**
 * Completion may collapse a block, but undoing completion must reopen it even
 * after auto-advance moved the current exercise. Otherwise preserve manual UI.
 */
export function nextExerciseCollapsed(
  wasCompleted: boolean,
  allSetsCompleted: boolean,
  isCurrent: boolean,
): boolean | undefined {
  if (allSetsCompleted) return true
  if (wasCompleted || isCurrent) return false
  return undefined
}
