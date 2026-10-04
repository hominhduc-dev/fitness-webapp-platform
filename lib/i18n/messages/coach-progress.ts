type LiftStatus = "insufficient_data" | "progressing" | "stalled"
type RecommendationStatus = "accepted" | "applied" | "dismissed" | "pending"
type EngineAction = "add_load" | "add_reps" | "establish_baseline" | "maintain" | "reduce_load"

export const coachProgressMessages = {
  en: {
    coachProgress: {
      loadError: "Couldn't load this trainee's progress.",
      alerts: {
        title: "Needs attention",
        empty: "No alerts in the last 3 weeks.",
        unread: "New",
        open: "Open",
      },
      strength: {
        title: "Strength trend",
        hint: "Estimated 1-rep max (e1RM) of the main lifts over 12 weeks. Status uses comparable sessions only.",
        empty: "No lifts with enough history yet.",
        status: {
          insufficient_data: "Not enough data",
          progressing: "Progressing",
          stalled: "Plateau",
        } satisfies Record<LiftStatus, string>,
      },
      volume: {
        title: "Weekly volume by muscle",
        hint: "This week's effective sets against the trainee's estimated MEV / MAV / MRV.",
        empty: "No training logged this week.",
        changesTitle: "Volume changes suggested to the trainee",
        noChanges: "No muscle needs a change this week.",
        status: {
          accepted: "Accepted",
          applied: "Applied",
          dismissed: "Dismissed",
          pending: "Not answered",
        } satisfies Record<RecommendationStatus, string>,
        sets: (current: number, recommended: number) => `${current} → ${recommended} sets`,
      },
      readiness: {
        title: "Readiness, last 14 days",
        average: (value: number) => `Average ${value}`,
        sleep: (hours: number) => `Sleep ${hours} h/night`,
        empty: "No check-ins in the last 14 days.",
        threshold: "Dashed line: alert threshold (50)",
      },
      compliance: {
        title: "Follows the engine's suggestions",
        hint: "Last 4 weeks, per kind of suggestion.",
        empty: "No suggestions recorded yet. Data builds up as the trainee trains.",
        action: {
          add_load: "Add weight",
          add_reps: "Add reps",
          establish_baseline: "Set a baseline",
          maintain: "Hold",
          reduce_load: "Go lighter",
        } satisfies Record<EngineAction, string>,
        shown: (count: number) => `${count} shown`,
        followed: "Followed",
        partial: "Partly",
        modified: "Changed",
        notAttempted: "Skipped",
        rollback: (pct: number) => `Next session went back: ${pct}%`,
      },
      consistency: {
        title: "Consistency, 12 weeks",
      },
      weight: {
        title: "Body weight trend",
        empty: "No weigh-ins in the last 90 days.",
        average: "7-day average",
        rate: "Per week",
        toGoal: "To goal",
      },
    },
  },
  vi: {
    coachProgress: {
      loadError: "Không tải được dữ liệu tiến độ của trainee.",
      alerts: {
        title: "Cần chú ý",
        empty: "Không có cảnh báo trong 3 tuần gần nhất.",
        unread: "Mới",
        open: "Xem",
      },
      strength: {
        title: "Xu hướng sức mạnh",
        hint: "e1RM (sức mạnh tối đa ước tính cho 1 lần nâng) của các bài chính trong 12 tuần. Trạng thái chỉ xét các buổi tập tương đương.",
        empty: "Chưa có bài nào đủ lịch sử.",
        status: {
          insufficient_data: "Chưa đủ dữ liệu",
          progressing: "Đang tiến bộ",
          stalled: "Đang chững",
        } satisfies Record<LiftStatus, string>,
      },
      volume: {
        title: "Volume tuần theo nhóm cơ",
        hint: "Số set hiệu quả tuần này so với MEV / MAV / MRV ước tính của trainee.",
        empty: "Tuần này chưa có buổi tập nào.",
        changesTitle: "Đề xuất volume đã gửi cho trainee",
        noChanges: "Tuần này không có nhóm cơ nào cần thay đổi.",
        status: {
          accepted: "Đã chấp nhận",
          applied: "Đã áp dụng",
          dismissed: "Đã bỏ qua",
          pending: "Chưa trả lời",
        } satisfies Record<RecommendationStatus, string>,
        sets: (current: number, recommended: number) => `${current} → ${recommended} set`,
      },
      readiness: {
        title: "Readiness 14 ngày gần nhất",
        average: (value: number) => `Trung bình ${value}`,
        sleep: (hours: number) => `Ngủ ${hours} giờ/đêm`,
        empty: "Không có check-in trong 14 ngày gần nhất.",
        threshold: "Đường nét đứt: ngưỡng cảnh báo (50)",
      },
      compliance: {
        title: "Mức làm theo gợi ý của engine",
        hint: "4 tuần gần nhất, theo từng loại gợi ý.",
        empty: "Chưa có gợi ý nào được ghi nhận. Dữ liệu sẽ tích luỹ dần khi trainee tập.",
        action: {
          add_load: "Tăng tạ",
          add_reps: "Thêm rep",
          establish_baseline: "Lấy mốc",
          maintain: "Giữ nguyên",
          reduce_load: "Giảm tạ",
        } satisfies Record<EngineAction, string>,
        shown: (count: number) => `${count} lần gợi ý`,
        followed: "Làm theo",
        partial: "Một phần",
        modified: "Làm khác",
        notAttempted: "Bỏ bài",
        rollback: (pct: number) => `Buổi sau phải hạ tạ lại: ${pct}%`,
      },
      consistency: {
        title: "Độ đều đặn 12 tuần",
      },
      weight: {
        title: "Xu hướng cân nặng",
        empty: "Không có lần cân nào trong 90 ngày gần nhất.",
        average: "Trung bình 7 ngày",
        rate: "Mỗi tuần",
        toGoal: "Còn tới mục tiêu",
      },
    },
  },
}
