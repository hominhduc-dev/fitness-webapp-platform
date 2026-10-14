import type { MovementPattern } from "@/lib/types"

/** Display order; mirrors the backend enum. */
export const MOVEMENT_PATTERNS: readonly MovementPattern[] = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "core",
  "isolation",
  "cardio",
  "mobility",
  "other",
]

const LABELS: Record<MovementPattern, { en: string; vi: string }> = {
  carry: { en: "Carry", vi: "Mang vác" },
  cardio: { en: "Cardio", vi: "Cardio" },
  core: { en: "Core", vi: "Core" },
  hinge: { en: "Hinge", vi: "Gập hông" },
  horizontal_pull: { en: "Horizontal pull", vi: "Kéo ngang" },
  horizontal_push: { en: "Horizontal push", vi: "Đẩy ngang" },
  isolation: { en: "Isolation", vi: "Cô lập" },
  lunge: { en: "Lunge", vi: "Lunge" },
  mobility: { en: "Mobility", vi: "Linh hoạt" },
  other: { en: "Other", vi: "Khác" },
  squat: { en: "Squat", vi: "Squat" },
  vertical_pull: { en: "Vertical pull", vi: "Kéo dọc" },
  vertical_push: { en: "Vertical push", vi: "Đẩy dọc" },
}

export function movementPatternLabel(pattern: MovementPattern, locale: "en" | "vi") {
  return LABELS[pattern][locale]
}
