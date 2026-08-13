/**
 * Trims the exercise library down to something worth putting in a prompt.
 *
 * The full library is ~2900 exercises (~63k tokens). Sending all of it made
 * every program generation slow and expensive, and it puts the feature out of
 * reach of any model with a modest context window. The model only needs a good
 * menu to choose from, not the whole warehouse — so keep what the trainee can
 * actually use, prefer what they already train, and cap per muscle group.
 *
 * Note the mapper still resolves AI output against the FULL catalog, so an
 * exercise omitted here is not a mapping failure if the model names it anyway.
 */

type CatalogExercise = {
  id: string
  name: string
  muscleGroup: string
  createdById: string | null
  variations: Array<{ id: string; name: string; equipment: string | null }>
}

type PromptExercise = {
  name: string
  muscleGroup: string
  variations?: string[]
}

/** Equipment labels (as stored on Variation.equipment) reachable per setting. */
const EQUIPMENT_ACCESS: Record<string, string[] | null> = {
  // null = no restriction
  full_gym: null,
  home_dumbbells: [
    "Bodyweight",
    "Dumbbell",
    "Kettlebell",
    "Resistance Band",
    "Bench",
    "Medicine Ball",
    "Weight Plate",
    "Weight Plate Bench",
    "EZ Bar",
    "Pull-up Bar",
    "TRX",
    "Bosu Ball",
    "Other",
  ],
  bodyweight: ["Bodyweight", "Pull-up Bar", "TRX", "Bosu Ball"],
}

const DEFAULT_PER_GROUP = 14
const FOCUSED_PER_GROUP = 26
/** Groups that only ever need a couple of entries in a strength program. */
const SMALL_GROUPS: Record<string, number> = { Cardio: 6, Other: 6 }
/**
 * Exercises the trainee already trains bypass the per-group cap entirely —
 * dropping them is what makes a generated program feel unrelated to the one
 * they are currently running. Bounded so a long history can't blow up the
 * prompt on its own.
 */
const MAX_RECENT_KEPT = 60

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function isReachable(exercise: CatalogExercise, allowed: string[] | null) {
  if (!allowed) return true
  return exercise.variations.some((variation) =>
    // A variation with no recorded equipment is assumed to need none.
    variation.equipment === null || allowed.includes(variation.equipment),
  )
}

function capFor(muscleGroup: string, focused: Set<string>) {
  if (SMALL_GROUPS[muscleGroup] !== undefined) return SMALL_GROUPS[muscleGroup]
  return focused.has(normalize(muscleGroup)) ? FOCUSED_PER_GROUP : DEFAULT_PER_GROUP
}

function selectCatalogForPrompt(
  catalog: CatalogExercise[],
  options: {
    availableEquipment: string
    focusAreas?: string[]
    recentExerciseNames?: string[]
  },
): PromptExercise[] {
  const allowed = EQUIPMENT_ACCESS[options.availableEquipment] ?? null
  const focused = new Set((options.focusAreas ?? []).map(normalize).filter(Boolean))
  const recent = new Set((options.recentExerciseNames ?? []).map(normalize))

  const reachable = catalog.filter((exercise) => isReachable(exercise, allowed))

  // Keep every exercise the trainee already trains, outside the cap.
  const keptRecent = reachable
    .filter((exercise) => recent.has(normalize(exercise.name)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_RECENT_KEPT)
  const keptRecentIds = new Set(keptRecent.map((exercise) => exercise.id))

  const byGroup = new Map<string, CatalogExercise[]>()
  for (const exercise of reachable) {
    if (keptRecentIds.has(exercise.id)) continue
    const group = byGroup.get(exercise.muscleGroup) ?? []
    group.push(exercise)
    byGroup.set(exercise.muscleGroup, group)
  }

  const chosen: CatalogExercise[] = [...keptRecent]

  for (const [muscleGroup, exercises] of byGroup) {
    const ranked = exercises.slice().sort((a, b) => {
      // Their own custom entries first, then stable alphabetical so the same
      // inputs always produce the same prompt.
      const customDelta = Number(b.createdById !== null) - Number(a.createdById !== null)
      if (customDelta !== 0) return customDelta

      return a.name.localeCompare(b.name)
    })

    // Recent picks already cover part of this group's budget.
    const alreadyKept = keptRecent.filter((exercise) => exercise.muscleGroup === muscleGroup).length
    const remaining = Math.max(0, capFor(muscleGroup, focused) - alreadyKept)
    chosen.push(...ranked.slice(0, remaining))
  }

  const selected: PromptExercise[] = chosen.map((exercise) => {
    const usable = allowed
      ? exercise.variations.filter((v) => v.equipment === null || allowed.includes(v.equipment))
      : exercise.variations

    return {
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      // Most exercises have exactly one variation, and the mapper falls back to
      // the first one anyway — so only spend tokens when there is a choice.
      ...(usable.length > 1 ? { variations: usable.map((v) => v.name) } : {}),
    }
  })

  return selected.sort(
    (a, b) => a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name),
  )
}

export { selectCatalogForPrompt, type CatalogExercise, type PromptExercise }
