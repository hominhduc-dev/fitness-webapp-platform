type CoachInsightCopy = {
  tab: string
  title: string
  description: string
  windowLabel: string
  windowOption: (days: number) => string
  analyze: string
  analyzing: string
  reanalyze: string
  empty: string
  stale: string
  generatedAt: (time: string) => string
  error: string
  vsPrevious: string
  noData: string
  programs: (names: string) => string
  noProgram: string
  metrics: {
    adherence: string
    adherenceDetail: (completed: number, planned: number) => string
    sets: (completed: number, total: number) => string
    extraSessions: (count: number) => string
    weight: string
    weightDetail: (change: string) => string
    toTarget: (kg: string) => string
    calories: string
    caloriesDetail: (pct: number | null, days: number) => string
    protein: string
    proteinDetail: (pct: number | null) => string
    readiness: string
    sleep: (hours: string) => string
    stress: (value: number) => string
  }
  liftsTitle: string
  liftBest: (weight: number, reps: number) => string
  liftNew: string
  areas: Record<"training" | "progression" | "weight" | "nutrition" | "recovery", string>
  suggestionsTitle: string
  suggestionsNote: string
}

const vi: CoachInsightCopy = {
  tab: "Phân tích AI",
  title: "Phân tích AI",
  description:
    "Tổng hợp mức bám program, sức mạnh, cân nặng, calories/protein và phục hồi của trainee, so với kỳ trước, kèm gợi ý cho coach.",
  windowLabel: "Khoảng thời gian",
  windowOption: (days) => `${days} ngày`,
  analyze: "Phân tích",
  analyzing: "Đang phân tích…",
  reanalyze: "Phân tích lại",
  empty: "Chưa có báo cáo cho khoảng này. Nhấn Phân tích để tạo.",
  stale: "Dữ liệu đã thay đổi từ lần phân tích trước.",
  generatedAt: (time) => `Phân tích lúc ${time}`,
  error: "Không thể phân tích. Vui lòng thử lại.",
  vsPrevious: "so với kỳ trước",
  noData: "Chưa có dữ liệu",
  programs: (names) => `Program: ${names}`,
  noProgram: "Chưa assign program nào",
  metrics: {
    adherence: "Bám program",
    adherenceDetail: (completed, planned) => `${completed}/${planned} buổi`,
    sets: (completed, total) => `${completed}/${total} set hoàn thành`,
    extraSessions: (count) => `+${count} buổi ngoài program`,
    weight: "Cân nặng",
    weightDetail: (change) => `${change} kg trong kỳ`,
    toTarget: (kg) => `Còn ${kg} kg tới mục tiêu`,
    calories: "Calories TB",
    caloriesDetail: (pct, days) => `${pct == null ? "--" : `${pct}%`} mục tiêu · ${days} ngày có ghi`,
    protein: "Protein TB",
    proteinDetail: (pct) => `${pct == null ? "--" : `${pct}%`} mục tiêu`,
    readiness: "Readiness TB",
    sleep: (hours) => `Ngủ ${hours} giờ`,
    stress: (value) => `Stress ${value}`,
  },
  liftsTitle: "Bài chính",
  liftBest: (weight, reps) => `Tốt nhất ${weight}kg × ${reps}`,
  liftNew: "Mới trong kỳ",
  areas: {
    training: "Tập luyện",
    progression: "Sức mạnh",
    weight: "Cân nặng",
    nutrition: "Dinh dưỡng",
    recovery: "Phục hồi",
  },
  suggestionsTitle: "Gợi ý cho coach",
  suggestionsNote: "Chỉ là gợi ý — AI không tự thay đổi program hay thực đơn.",
}

const en: CoachInsightCopy = {
  tab: "AI analysis",
  title: "AI analysis",
  description:
    "Program adherence, strength, weight, calories/protein and recovery for this trainee, compared with the previous period, with suggestions for you.",
  windowLabel: "Period",
  windowOption: (days) => `${days} days`,
  analyze: "Analyze",
  analyzing: "Analyzing…",
  reanalyze: "Analyze again",
  empty: "No report for this period yet. Press Analyze to create one.",
  stale: "The data has changed since this analysis.",
  generatedAt: (time) => `Analyzed at ${time}`,
  error: "Could not analyze. Please try again.",
  vsPrevious: "vs previous period",
  noData: "No data yet",
  programs: (names) => `Program: ${names}`,
  noProgram: "No program assigned",
  metrics: {
    adherence: "Program adherence",
    adherenceDetail: (completed, planned) => `${completed}/${planned} sessions`,
    sets: (completed, total) => `${completed}/${total} sets done`,
    extraSessions: (count) => `+${count} outside the program`,
    weight: "Weight",
    weightDetail: (change) => `${change} kg this period`,
    toTarget: (kg) => `${kg} kg to target`,
    calories: "Avg calories",
    caloriesDetail: (pct, days) => `${pct == null ? "--" : `${pct}%`} of goal · ${days} days logged`,
    protein: "Avg protein",
    proteinDetail: (pct) => `${pct == null ? "--" : `${pct}%`} of goal`,
    readiness: "Avg readiness",
    sleep: (hours) => `Sleep ${hours} h`,
    stress: (value) => `Stress ${value}`,
  },
  liftsTitle: "Main lifts",
  liftBest: (weight, reps) => `Best ${weight}kg × ${reps}`,
  liftNew: "New this period",
  areas: {
    training: "Training",
    progression: "Strength",
    weight: "Weight",
    nutrition: "Nutrition",
    recovery: "Recovery",
  },
  suggestionsTitle: "Suggestions for you",
  suggestionsNote: "Suggestions only — the AI never changes the program or meal plan.",
}

export const coachInsightMessages = { en, vi }
export type { CoachInsightCopy }
