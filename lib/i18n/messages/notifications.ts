type MealLabels = { breakfast: string; dinner: string; lunch: string; snack: string }

export const notificationsMessages = {
  en: {
    notificationCenter: {
      empty: "You're all caught up.",
      emptyCopy: "Reminders and updates from your coach will show up here.",
      loadError: "Unable to load notifications.",
      markAllRead: "Mark all as read",
      open: (unread: number) => (unread > 0 ? `Notifications, ${unread} unread` : "Notifications"),
      reset: "Reset",
      settings: "Notification settings",
      title: "Notifications",
      unread: "Unread",
      mealLabels: { breakfast: "Breakfast", dinner: "Dinner", lunch: "Lunch", snack: "Snack" } satisfies MealLabels,
      copy: {
        checkInReminder: { message: "How are you feeling today?", title: "Morning check-in" },
        coachWeeklyReview: {
          idle: (count: number, names: string) =>
            count === 1 ? ` 1 hasn't trained yet: ${names}.` : ` ${count} haven't trained yet: ${names}.`,
          message: (trainees: number, workouts: number) =>
            `${trainees === 1 ? "Your trainee" : `Your ${trainees} trainees`} logged ${workouts} workout${workouts === 1 ? "" : "s"} this week.`,
          suffix: " Review their progress.",
          title: "Weekly trainee review",
        },
        mealReminder: {
          message: (meal: string) => `Don't forget to log your ${meal.toLowerCase()}.`,
          title: (meal: string) => `${meal} reminder`,
        },
        programAssigned: {
          message: (program: string) => `Your coach assigned ${program}.`,
          title: "New program assigned",
        },
        programUpdated: {
          message: (target: string) => `${target} has been adjusted by your coach.`,
          title: "Coach updated your program",
        },
        weightReminder: { message: "A quick check-in keeps your trend accurate.", title: "Time to log your weight" },
        workoutLogged: {
          message: (trainee: string, workout: string) => `${trainee} completed ${workout}.`,
          title: (trainee: string) => `${trainee} logged a workout`,
        },
        workoutReminder: {
          message: (workout: string, time: string) => `${workout} is scheduled at ${time}.`,
          title: "Workout starts soon",
        },
        workoutSessionOpen: {
          message: (workout: string, elapsed: string) => `You started ${workout} ${elapsed}. Finish or resume it?`,
          title: "Workout still open",
        },
      },
    },
  },
  vi: {
    notificationCenter: {
      empty: "Bạn đã xem hết thông báo.",
      emptyCopy: "Nhắc nhở và cập nhật từ coach sẽ hiện ở đây.",
      loadError: "Không thể tải thông báo.",
      markAllRead: "Đánh dấu đã đọc tất cả",
      open: (unread: number) => (unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"),
      reset: "Reset",
      settings: "Cài đặt thông báo",
      title: "Thông báo",
      unread: "Chưa đọc",
      mealLabels: { breakfast: "Bữa sáng", dinner: "Bữa tối", lunch: "Bữa trưa", snack: "Bữa phụ" } satisfies MealLabels,
      copy: {
        checkInReminder: { message: "Hôm nay bạn cảm thấy thế nào?", title: "Check-in buổi sáng" },
        coachWeeklyReview: {
          idle: (count: number, names: string) => ` ${count} học viên chưa tập: ${names}.`,
          message: (trainees: number, workouts: number) =>
            `${trainees} học viên đã ghi ${workouts} buổi tập trong tuần này.`,
          suffix: " Xem lại số liệu của học viên nhé.",
          title: "Tổng kết tuần của học viên",
        },
        mealReminder: {
          message: (meal: string) => `Đừng quên ghi lại ${meal.toLowerCase()} nhé.`,
          title: (meal: string) => `Nhắc ${meal.toLowerCase()}`,
        },
        programAssigned: {
          message: (program: string) => `Coach đã giao chương trình ${program}.`,
          title: "Chương trình mới",
        },
        programUpdated: {
          message: (target: string) => `Coach đã điều chỉnh ${target}.`,
          title: "Coach đã cập nhật chương trình",
        },
        weightReminder: { message: "Ghi nhanh cân nặng để biểu đồ luôn chính xác.", title: "Đến giờ ghi cân nặng" },
        workoutLogged: {
          message: (trainee: string, workout: string) => `${trainee} đã hoàn thành ${workout}.`,
          title: (trainee: string) => `${trainee} vừa ghi buổi tập`,
        },
        workoutReminder: {
          message: (workout: string, time: string) => `${workout} được lên lịch lúc ${time}.`,
          title: "Sắp đến giờ tập",
        },
        workoutSessionOpen: {
          message: (workout: string, elapsed: string) => `Bạn đã bắt đầu ${workout} ${elapsed}. Hoàn thành hoặc tiếp tục nhé?`,
          title: "Buổi tập chưa hoàn thành",
        },
      },
    },
  },
}
