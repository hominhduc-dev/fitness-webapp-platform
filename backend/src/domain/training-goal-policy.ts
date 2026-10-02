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

/** Longest block, deload included, before fatigue has to be shed. */
const MAX_BLOCK_WEEKS = 7
/** A block shorter than this is too short to earn a deload of its own. */
const MIN_BLOCK_WEEKS_FOR_DELOAD = 4

/**
 * Splits the weeks after the baseline into mesocycle blocks of near-equal
 * length, longer ones last, so the program always ends on its deload.
 */
function blockLengths(trainingWeeks: number) {
  const blockCount = Math.max(1, Math.ceil(trainingWeeks / MAX_BLOCK_WEEKS))
  const base = Math.floor(trainingWeeks / blockCount)
  const extra = trainingWeeks % blockCount
  return Array.from({ length: blockCount }, (_, index) => base + (index >= blockCount - extra ? 1 : 0))
}

/**
 * Week 0 is the baseline. The rest is cut into blocks of at most seven weeks,
 * each ending on a deload once it is long enough to need one. Inside a block
 * the loading weeks climb from accumulation to intensification, and only the
 * last loading week before a deload is overreaching — the one week a goal's
 * hardest RIR target applies. Earlier versions ran every week from the third
 * on as overreaching, which held hypertrophy trainees at 0 RIR for weeks.
 */
function phaseForWeek(weekIndex: number, duration: number): TrainingPhase {
  if (weekIndex <= 0) return "baseline"

  let blockStart = 1
  for (const length of blockLengths(Math.max(1, duration - 1))) {
    if (weekIndex < blockStart + length) {
      const position = weekIndex - blockStart
      const hasDeload = length >= MIN_BLOCK_WEEKS_FOR_DELOAD
      const loadingWeeks = hasDeload ? length - 1 : length
      if (hasDeload && position === length - 1) return "deload"
      if (hasDeload && loadingWeeks >= 3 && position === loadingWeeks - 1) return "overreaching"
      const rampWeeks = hasDeload && loadingWeeks >= 3 ? loadingWeeks - 1 : loadingWeeks
      return position < Math.ceil(rampWeeks / 2) ? "accumulation" : "intensification"
    }
    blockStart += length
  }

  return "intensification"
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

/**
 * Null once the program has run its course: the weeks after it belong to no
 * block, so there is no phase or RIR target left to hold the trainee to.
 */
function policyForTrainingGoal(goal: TrainingGoal | null, weekIndex: number, duration: number): TrainingGoalPolicy | null {
  if (!goal || weekIndex >= duration) return null
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
