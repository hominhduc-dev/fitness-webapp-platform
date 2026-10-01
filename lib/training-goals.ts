export const TRAINING_GOAL_OPTIONS = [
  { en: "Hypertrophy", value: "hypertrophy", vi: "Tăng cơ" },
  { en: "Strength", value: "strength", vi: "Sức mạnh" },
  { en: "Powerbuilding", value: "powerbuilding", vi: "Tăng cơ + sức mạnh" },
  { en: "Fat loss", value: "fat_loss", vi: "Giảm mỡ" },
  { en: "Endurance", value: "endurance", vi: "Sức bền" },
  { en: "General", value: "general_fitness", vi: "Tổng hợp" },
  { en: "Athletic", value: "athletic_performance", vi: "Hiệu suất thể thao" },
  { en: "Rehab", value: "rehab_corrective", vi: "Phục hồi / sửa vận động" },
] as const

export type TrainingGoal = (typeof TRAINING_GOAL_OPTIONS)[number]["value"]

export function normalizeTrainingGoal(value: string | null | undefined): TrainingGoal | null {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (!normalized) return null

  if (["build_muscle", "hypertrophy", "muscle_gain", "tang_co", "tăng_cơ"].includes(normalized)) {
    return "hypertrophy"
  }
  if (["strength", "increase_strength", "tang_suc_manh", "tăng_sức_mạnh"].includes(normalized)) {
    return "strength"
  }
  if (["powerbuilding", "power_building", "strength_hypertrophy"].includes(normalized)) {
    return "powerbuilding"
  }
  if (["lose_weight", "fat_loss", "weight_loss", "recomposition", "body_recomposition", "giam_mo", "giảm_mỡ"].includes(normalized)) {
    return "fat_loss"
  }
  if (["endurance", "improve_endurance", "suc_ben", "sức_bền"].includes(normalized)) {
    return "endurance"
  }
  if (["general", "general_fitness", "fitness", "tong_hop", "tổng_hợp"].includes(normalized)) {
    return "general_fitness"
  }
  if (["athletic", "athletic_performance", "sport", "sports_performance"].includes(normalized)) {
    return "athletic_performance"
  }
  if (["rehab", "corrective", "rehab_corrective", "rehabilitation", "prehab", "phuc_hoi", "phục_hồi"].includes(normalized)) {
    return "rehab_corrective"
  }

  return null
}
