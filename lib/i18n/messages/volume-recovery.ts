const muscleLabelsEn = {
  abs: "Abs", adductors: "Adductors", biceps: "Biceps", calves: "Calves", chest: "Chest",
  deltoids: "Deltoids", forearm: "Forearms", gluteal: "Glutes", hamstring: "Hamstrings",
  "lower-back": "Lower back", obliques: "Obliques", quadriceps: "Quads", tibialis: "Tibialis",
  trapezius: "Traps", triceps: "Triceps", "upper-back": "Upper back",
}

const muscleLabelsVi: Record<keyof typeof muscleLabelsEn, string> = {
  abs: "Bụng", adductors: "Cơ khép", biceps: "Tay trước", calves: "Bắp chân", chest: "Ngực",
  deltoids: "Vai", forearm: "Cẳng tay", gluteal: "Mông", hamstring: "Đùi sau",
  "lower-back": "Lưng dưới", obliques: "Liên sườn", quadriceps: "Đùi trước", tibialis: "Cẳng chân trước",
  trapezius: "Cầu vai", triceps: "Tay sau", "upper-back": "Lưng trên",
}

export const volumeRecoveryMessages = {
  en: {
    volumeRecovery: {
      tab: "Volume",
      title: "Volume & Recovery",
      subtitle: "Personalized weekly training landmarks.",
      readiness: "Readiness",
      ready: "Ready to train",
      moderate: "Train with caution",
      low: "Recovery is low",
      insufficient: "Check in to calculate readiness",
      checkIn: "Check in",
      updateCheckIn: "Update check-in",
      weeklyVolume: "Weekly muscle volume",
      noVolume: "Complete a workout with logged reps to calculate muscle volume.",
      hardSets: "Hard sets",
      avgRir: "Avg RIR",
      performance: "Performance",
      recoverySignals: "Recovery signals",
      sleep: "Sleep",
      fatigue: "Fatigue",
      stress: "Stress",
      soreness: "Soreness",
      coachInsight: "YB Coach Insight",
      directSets: "direct",
      indirectSets: "indirect",
      lowConfidenceSets: "sets need RIR",
      sets: "sets",
      notSet: "Not set",
      confidence: "Confidence",
      confidenceLow: "Low",
      confidenceMedium: "Medium",
      zones: {
        above_mrv: "Above MRV", below_mev: "Below MEV", insufficient_data: "Need data",
        mav: "MAV", mev_to_mav: "MEV–MAV", near_mrv: "Near MRV",
      },
      recommendation: (action: string, muscle: string) =>
        action === "increase"
          ? `${muscle} is below MEV. Consider adding one hard set next week.`
          : action === "decrease"
            ? `${muscle} shows declining performance and recovery. Reduce volume slightly.`
            : action === "deload"
              ? `${muscle} is above MRV with repeated recovery issues. Consider a deload.`
              : `Keep ${muscle} volume steady while more data is collected.`,
      formTitle: "Daily recovery check-in",
      formDescription: "A quick check-in improves the confidence of volume recommendations.",
      sleepQuality: "Sleep quality",
      sleepDuration: "Sleep duration",
      hours: "Hours",
      minutes: "Minutes",
      invalidSleepDuration: "Enter 0–24 hours and 0–59 minutes (maximum 24 hours).",
      fatigueLevel: "Fatigue",
      stressLevel: "Stress (optional)",
      muscleSoreness: "Muscle soreness",
      save: "Save check-in",
      saving: "Saving...",
      cancel: "Cancel",
      lowValue: "Low",
      highValue: "High",
      saveError: "Unable to save your check-in.",
      muscleLabels: muscleLabelsEn,
    },
  },
  vi: {
    volumeRecovery: {
      tab: "Volume",
      title: "Volume & phục hồi",
      subtitle: "Theo dõi ngưỡng tập luyện cá nhân theo tuần.",
      readiness: "Mức sẵn sàng",
      ready: "Sẵn sàng tập luyện",
      moderate: "Nên tập thận trọng",
      low: "Khả năng phục hồi thấp",
      insufficient: "Check-in để tính mức sẵn sàng",
      checkIn: "Check-in",
      updateCheckIn: "Cập nhật check-in",
      weeklyVolume: "Volume nhóm cơ trong tuần",
      noVolume: "Hoàn thành một buổi tập có ghi số reps để tính volume nhóm cơ.",
      hardSets: "Hard sets",
      avgRir: "RIR trung bình",
      performance: "Hiệu suất",
      recoverySignals: "Tín hiệu phục hồi",
      sleep: "Giấc ngủ",
      fatigue: "Mệt mỏi",
      stress: "Căng thẳng",
      soreness: "Đau mỏi cơ",
      coachInsight: "Nhận định từ YB Coach",
      directSets: "trực tiếp",
      indirectSets: "gián tiếp",
      lowConfidenceSets: "set thiếu RIR",
      sets: "set",
      notSet: "Chưa đặt",
      confidence: "Độ tin cậy",
      confidenceLow: "Thấp",
      confidenceMedium: "Trung bình",
      zones: {
        above_mrv: "Trên MRV", below_mev: "Dưới MEV", insufficient_data: "Cần dữ liệu",
        mav: "MAV", mev_to_mav: "MEV–MAV", near_mrv: "Gần MRV",
      },
      recommendation: (action: string, muscle: string) =>
        action === "increase"
          ? `${muscle} đang dưới MEV. Có thể thêm một hard set vào tuần sau.`
          : action === "decrease"
            ? `${muscle} có hiệu suất và phục hồi giảm. Nên giảm nhẹ volume.`
            : action === "deload"
              ? `${muscle} đang trên MRV với dấu hiệu phục hồi kém lặp lại. Nên cân nhắc deload.`
              : `Giữ ổn định volume của ${muscle} trong khi tiếp tục thu thập dữ liệu.`,
      formTitle: "Check-in phục hồi hằng ngày",
      formDescription: "Một check-in nhanh giúp đề xuất volume đáng tin cậy hơn.",
      sleepQuality: "Chất lượng giấc ngủ",
      sleepDuration: "Thời lượng ngủ",
      hours: "Giờ",
      minutes: "Phút",
      invalidSleepDuration: "Nhập 0–24 giờ và 0–59 phút (tối đa 24 giờ).",
      fatigueLevel: "Mức mệt mỏi",
      stressLevel: "Mức căng thẳng (không bắt buộc)",
      muscleSoreness: "Đau mỏi theo nhóm cơ",
      save: "Lưu check-in",
      saving: "Đang lưu...",
      cancel: "Hủy",
      lowValue: "Thấp",
      highValue: "Cao",
      saveError: "Không thể lưu check-in.",
      muscleLabels: muscleLabelsVi,
    },
  },
} as const
