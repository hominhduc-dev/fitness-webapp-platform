import type { ExerciseActivityType, MovementPattern, MuscleSlug } from "@/lib/types"

/**
 * The library's browse cards. An exercise belongs to exactly one card, picked
 * from its first primary muscle, so counts add up to the library size.
 * Cardio and mobility work go by activity/pattern instead, since their muscles
 * say little about where someone would look for them.
 */
export type LibraryGroupKey =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "glutes"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "calves"
  | "cardio"
  | "other"

export type LibraryGroup = {
  key: LibraryGroupKey
  label: { en: string; vi: string }
  description: { en: string; vi: string }
  /** Painted on the card's silhouette. */
  slugs: readonly MuscleSlug[]
}

export const LIBRARY_GROUPS: readonly LibraryGroup[] = [
  { key: "chest", label: { en: "Chest", vi: "Ngực" }, description: { en: "Presses, push-ups and flyes for the pectorals.", vi: "Các bài đẩy, hít đất và ép ngực." }, slugs: ["chest"] },
  { key: "back", label: { en: "Back", vi: "Lưng" }, description: { en: "Rows, pull-downs and pull-ups for the lats, traps and lower back.", vi: "Các bài kéo, chèo và hít xà cho lưng xô, cầu vai và lưng dưới." }, slugs: ["upper-back", "trapezius", "lower-back"] },
  { key: "shoulders", label: { en: "Shoulders", vi: "Vai" }, description: { en: "Overhead presses and raises for the deltoids.", vi: "Các bài đẩy vai và nâng tạ cho cơ delta." }, slugs: ["deltoids"] },
  { key: "legs", label: { en: "Legs", vi: "Chân" }, description: { en: "Squats, lunges and leg isolation for quads, hamstrings and adductors.", vi: "Squat, lunge và bài cô lập cho đùi trước, đùi sau và cơ khép." }, slugs: ["quadriceps", "hamstring", "adductors"] },
  { key: "glutes", label: { en: "Glutes", vi: "Mông" }, description: { en: "Hip thrusts, bridges and hinges for the glutes.", vi: "Hip thrust, bridge và các bài gập hông cho cơ mông." }, slugs: ["gluteal"] },
  { key: "biceps", label: { en: "Biceps", vi: "Tay trước" }, description: { en: "Curls in every grip and angle.", vi: "Các bài curl với mọi kiểu cầm và góc." }, slugs: ["biceps"] },
  { key: "triceps", label: { en: "Triceps", vi: "Tay sau" }, description: { en: "Pushdowns, extensions and close-grip presses.", vi: "Pushdown, extension và đẩy hẹp tay." }, slugs: ["triceps"] },
  { key: "forearms", label: { en: "Forearms", vi: "Cẳng tay" }, description: { en: "Wrist curls, grip and forearm work.", vi: "Wrist curl, bài tập lực nắm và cẳng tay." }, slugs: ["forearm"] },
  { key: "abs", label: { en: "Abs", vi: "Bụng" }, description: { en: "Crunches, planks, rotations and anti-rotation.", vi: "Gập bụng, plank, xoay và chống xoay." }, slugs: ["abs", "obliques"] },
  { key: "calves", label: { en: "Calves", vi: "Bắp chân" }, description: { en: "Calf raises and lower-leg work.", vi: "Nhón bắp chân và bài cho cẳng chân." }, slugs: ["calves", "tibialis"] },
  { key: "cardio", label: { en: "Cardio", vi: "Cardio" }, description: { en: "Conditioning, intervals and endurance work.", vi: "Bài sức bền, interval và tim mạch." }, slugs: [] },
  { key: "other", label: { en: "Mobility & other", vi: "Linh hoạt & khác" }, description: { en: "Stretches, warm-ups, carries and full-body skills.", vi: "Giãn cơ, khởi động, mang vác và kỹ năng toàn thân." }, slugs: [] },
]

const GROUP_BY_SLUG: Partial<Record<MuscleSlug, LibraryGroupKey>> = Object.fromEntries(
  LIBRARY_GROUPS.flatMap((group) => group.slugs.map((slug) => [slug, group.key])),
)

/** Old free-text groups, for exercises that have no muscle profile yet. */
const GROUP_BY_LEGACY: Record<string, LibraryGroupKey> = {
  arms: "biceps",
  back: "back",
  calves: "calves",
  cardio: "cardio",
  chest: "chest",
  core: "abs",
  glutes: "glutes",
  legs: "legs",
  shoulders: "shoulders",
}

type GroupableExercise = {
  activityType?: ExerciseActivityType
  movementPattern?: MovementPattern
  muscleGroup?: string | null
  primaryMuscles: readonly MuscleSlug[]
}

export function libraryGroupOf(exercise: GroupableExercise): LibraryGroupKey {
  if (exercise.activityType === "cardio" || exercise.movementPattern === "cardio") return "cardio"
  if (exercise.activityType === "mobility" || exercise.movementPattern === "mobility" || exercise.movementPattern === "carry") return "other"

  const primary = exercise.primaryMuscles[0]
  const fromMuscle = primary ? GROUP_BY_SLUG[primary] : undefined
  if (fromMuscle) return fromMuscle

  return GROUP_BY_LEGACY[exercise.muscleGroup?.trim().toLowerCase() ?? ""] ?? "other"
}

export function getLibraryGroup(key: LibraryGroupKey) {
  return LIBRARY_GROUPS.find((group) => group.key === key) ?? LIBRARY_GROUPS[LIBRARY_GROUPS.length - 1]
}

/** Equipment chips in the mockup's order; anything else falls under its own label after these. */
const EQUIPMENT_CHIP_ORDER = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Resistance Band", "Kettlebell", "Smith Machine", "EZ Bar"]

export function sortEquipmentChips(values: Iterable<string>) {
  const rank = (value: string) => {
    const index = EQUIPMENT_CHIP_ORDER.indexOf(value)
    return index === -1 ? EQUIPMENT_CHIP_ORDER.length : index
  }
  return [...new Set(values)].sort((left, right) => rank(left) - rank(right) || left.localeCompare(right))
}
