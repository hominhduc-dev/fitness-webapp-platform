type TrainingGoal =
  | "athletic_performance"
  | "endurance"
  | "fat_loss"
  | "general_fitness"
  | "hypertrophy"
  | "powerbuilding"
  | "rehab_corrective"
  | "strength"

type TrainingPhase = "baseline" | "accumulation" | "intensification" | "overreaching" | "deload"

type TrainingGoalPolicy = {
  analysisFocus: string[]
  baselineWeek: boolean
  goal: TrainingGoal
  phase: TrainingPhase
  targetRir: number | null
  targetRpe: number | null
}

function normalizeTrainingGoal(value: string | null | undefined, fallbackGoals: readonly string[] = []): TrainingGoal | null {
  const source = [value, ...fallbackGoals].find((goal) => typeof goal === "string" && goal.trim().length > 0)
  const normalized = source?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? null
  if (!normalized) return null

  if (["build_muscle", "hypertrophy", "muscle_gain", "tang_co", "tăng_cơ"].includes(normalized)) return "hypertrophy"
  if (["strength", "increase_strength", "tang_suc_manh", "tăng_sức_mạnh"].includes(normalized)) return "strength"
  if (["powerbuilding", "power_building", "strength_hypertrophy"].includes(normalized)) return "powerbuilding"
  if (["lose_weight", "fat_loss", "weight_loss", "recomposition", "body_recomposition", "giam_mo", "giảm_mỡ"].includes(normalized)) return "fat_loss"
  if (["endurance", "improve_endurance", "suc_ben", "sức_bền"].includes(normalized)) return "endurance"
  if (["general", "general_fitness", "fitness", "tong_hop", "tổng_hợp"].includes(normalized)) return "general_fitness"
  if (["athletic", "athletic_performance", "sport", "sports_performance"].includes(normalized)) return "athletic_performance"
  if (["rehab", "corrective", "rehab_corrective", "rehabilitation", "prehab", "phuc_hoi", "phục_hồi"].includes(normalized)) return "rehab_corrective"

  return null
}

function rpeFromRir(rir: number | null) {
  return rir == null ? null : Math.max(5, Math.min(10, 10 - rir))
}

function phaseForWeek(weekIndex: number, duration: number): TrainingPhase {
  if (weekIndex <= 0) return "baseline"
  if (duration >= 5 && weekIndex >= duration - 1) return "deload"
  if (weekIndex === 1) return "accumulation"
  if (weekIndex === 2) return "intensification"
  return "overreaching"
}

function targetRirForGoal(goal: TrainingGoal, phase: TrainingPhase) {
  if (goal === "rehab_corrective") return phase === "deload" ? 5 : 4
  if (phase === "baseline") {
    if (goal === "strength" || goal === "powerbuilding") return 3
    if (goal === "endurance" || goal === "fat_loss" || goal === "athletic_performance") return 4
    return 4
  }
  if (phase === "deload") return goal === "strength" || goal === "powerbuilding" ? 4 : 5

  const byGoal: Record<TrainingGoal, Record<Exclude<TrainingPhase, "baseline" | "deload">, number>> = {
    athletic_performance: { accumulation: 3, intensification: 2, overreaching: 2 },
    endurance: { accumulation: 3, intensification: 2, overreaching: 2 },
    fat_loss: { accumulation: 3, intensification: 2, overreaching: 2 },
    general_fitness: { accumulation: 3, intensification: 2, overreaching: 2 },
    hypertrophy: { accumulation: 2, intensification: 1, overreaching: 0 },
    powerbuilding: { accumulation: 2, intensification: 1, overreaching: 1 },
    rehab_corrective: { accumulation: 4, intensification: 4, overreaching: 4 },
    strength: { accumulation: 3, intensification: 2, overreaching: 1 },
  }

  return byGoal[goal][phase]
}

function analysisFocusForGoal(goal: TrainingGoal) {
  switch (goal) {
    case "hypertrophy":
      return ["muscle_volume", "rir_progression", "soreness", "performance_trend"]
    case "strength":
      return ["e1rm_trend", "top_sets", "technical_fatigue", "rir_control"]
    case "powerbuilding":
      return ["top_sets", "backoff_volume", "muscle_volume", "rir_control"]
    case "fat_loss":
      return ["strength_retention", "nutrition_adherence", "recovery", "conditioning"]
    case "endurance":
      return ["rep_capacity", "session_density", "conditioning", "recovery"]
    case "athletic_performance":
      return ["power_output", "compound_strength", "speed_quality", "recovery"]
    case "rehab_corrective":
      return ["pain_response", "movement_quality", "high_rir_compliance", "safe_progression"]
    case "general_fitness":
      return ["consistency", "balanced_volume", "readiness", "strength_retention"]
  }
}

function policyForTrainingGoal(goal: TrainingGoal | null, weekIndex: number, duration: number): TrainingGoalPolicy | null {
  if (!goal) return null
  const phase = phaseForWeek(weekIndex, duration)
  const targetRir = targetRirForGoal(goal, phase)

  return {
    analysisFocus: analysisFocusForGoal(goal),
    baselineWeek: phase === "baseline",
    goal,
    phase,
    targetRir,
    targetRpe: rpeFromRir(targetRir),
  }
}

export { normalizeTrainingGoal, policyForTrainingGoal }
export type { TrainingGoal, TrainingGoalPolicy, TrainingPhase }
