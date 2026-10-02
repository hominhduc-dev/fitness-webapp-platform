type DayAction = "light_session" | "proceed" | "reduce_volume" | "rest"
type ExerciseAction = "add_load" | "add_reps" | "establish_baseline" | "maintain" | "reduce_load"
type MuscleAction = "decrease" | "deload" | "increase" | "maintain"

export const trainingRecommendationMessages = {
  en: {
    trainingRecommendation: {
      title: "Today's plan",
      day: {
        light_session: "Light session",
        proceed: "Train as planned",
        reduce_volume: "Trim the volume",
        rest: "Rest day",
      } satisfies Record<DayAction, string>,
      setAdjustment: (pct: number) => `${pct > 0 ? "+" : ""}${pct}% sets`,
      targetRir: (rir: number) => `RIR ${rir}`,
      phase: {
        accumulation: "Accumulation",
        baseline: "Baseline week",
        deload: "Deload",
        intensification: "Intensification",
        overreaching: "Peak week",
      } as Record<string, string>,
      exercise: {
        add_load: "Add weight",
        add_reps: "Add a rep",
        establish_baseline: "Set a baseline",
        maintain: "Hold",
        reduce_load: "Go lighter",
      } satisfies Record<ExerciseAction, string>,
      setDelta: (delta: number) => `${delta > 0 ? "+" : ""}${delta} set${Math.abs(delta) === 1 ? "" : "s"}`,
      heldByDay: "held for readiness",
      heldByMuscle: (muscle: string) => `${muscle} volume`,
      muscle: {
        decrease: "Reduce",
        deload: "Deload",
        increase: "Add",
        maintain: "Keep",
      } satisfies Record<MuscleAction, string>,
      weeklyVolume: "This week's volume",
      noWorkout: "No session scheduled today.",
      completed: "Done today",
      moreExercises: (count: number) => `+${count} more`,
      startWorkout: "Start",
      unavailable: "Recommendation unavailable right now.",
    },
  },
  vi: {
    trainingRecommendation: {
      title: "Kế hoạch hôm nay",
      day: {
        light_session: "Buổi nhẹ",
        proceed: "Tập theo kế hoạch",
        reduce_volume: "Giảm bớt volume",
        rest: "Nghỉ ngơi",
      } satisfies Record<DayAction, string>,
      setAdjustment: (pct: number) => `${pct > 0 ? "+" : ""}${pct}% số set`,
      targetRir: (rir: number) => `RIR ${rir}`,
      phase: {
        accumulation: "Tích lũy",
        baseline: "Tuần nền",
        deload: "Deload",
        intensification: "Tăng cường",
        overreaching: "Tuần đỉnh",
      } as Record<string, string>,
      exercise: {
        add_load: "Tăng tạ",
        add_reps: "Thêm rep",
        establish_baseline: "Lấy mốc",
        maintain: "Giữ nguyên",
        reduce_load: "Giảm tạ",
      } satisfies Record<ExerciseAction, string>,
      setDelta: (delta: number) => `${delta > 0 ? "+" : ""}${delta} set`,
      heldByDay: "giữ vì readiness",
      heldByMuscle: (muscle: string) => `theo volume ${muscle}`,
      muscle: {
        decrease: "Giảm",
        deload: "Deload",
        increase: "Tăng",
        maintain: "Giữ",
      } satisfies Record<MuscleAction, string>,
      weeklyVolume: "Volume tuần này",
      noWorkout: "Hôm nay không có buổi tập theo lịch.",
      completed: "Đã tập hôm nay",
      moreExercises: (count: number) => `+${count} bài`,
      startWorkout: "Bắt đầu",
      unavailable: "Chưa lấy được đề xuất lúc này.",
    },
  },
} as const
