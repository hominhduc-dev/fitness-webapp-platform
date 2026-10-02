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
        coachConnection: {
          accepted: { message: (name: string, invitation: boolean) => `${name} accepted your ${invitation ? "invitation" : "request"}.`, title: "You're connected" },
          inviteReceived: { message: (name: string) => `${name} wants to be your coach. Tap to answer.`, title: "Coach invitation" },
          requestReceived: { message: (name: string) => `${name} wants you as their coach. Tap to answer.`, title: "New trainee request" },
        },
        coachSignupPending: {
          message: (name: string, others: number) =>
            `${name} applied to be a coach.${others > 0 ? ` ${others} more ${others === 1 ? "is" : "are"} waiting.` : " Tap to review."}`,
          title: "New coach application",
        },
        exerciseSharePending: {
          message: (coach: string, exercise: string, others: number) =>
            `${coach} suggested ${exercise} for the shared library.${others > 0 ? ` ${others} more ${others === 1 ? "is" : "are"} waiting.` : " Tap to review."}`,
          title: "Exercise to review",
        },
        exerciseShareReviewed: {
          approved: (exercise: string) => `${exercise} is now in the shared library.`,
          merged: (exercise: string, target?: string) => `${exercise} was merged into ${target ?? "a library exercise"}; your programs now use it.`,
          rejected: (exercise: string, note?: string) => `${exercise} stays in your own library.${note ? ` Note: ${note}` : ""}`,
          sharedTitle: "Exercise shared",
          notSharedTitle: "Exercise not shared",
        },
        workoutLogged: {
          message: (trainee: string, workout: string) => `${trainee} completed ${workout}.`,
          notes: (notes: string) => ` Notes: ${notes}`,
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
    pushPrompt: {
      body: "Workout reminders, meal nudges and coach updates reach you even when the app is closed.",
      dismiss: "Not now",
      enable: "Turn on",
      title: "Turn on notifications",
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
        coachConnection: {
          accepted: { message: (name: string, invitation: boolean) => `${name} đã chấp nhận ${invitation ? "lời mời" : "yêu cầu"} của bạn.`, title: "Đã kết nối" },
          inviteReceived: { message: (name: string) => `${name} muốn làm coach của bạn. Chạm để trả lời.`, title: "Lời mời kết nối từ coach" },
          requestReceived: { message: (name: string) => `${name} muốn bạn làm coach. Chạm để trả lời.`, title: "Yêu cầu học viên mới" },
        },
        coachSignupPending: {
          message: (name: string, others: number) =>
            `${name} vừa đăng ký làm coach.${others > 0 ? ` Còn ${others} hồ sơ khác đang chờ.` : " Chạm để duyệt."}`,
          title: "Hồ sơ coach mới cần duyệt",
        },
        exerciseSharePending: {
          message: (coach: string, exercise: string, others: number) =>
            `${coach} đề xuất ${exercise} vào thư viện chung.${others > 0 ? ` Còn ${others} bài khác đang chờ.` : " Chạm để duyệt."}`,
          title: "Bài tập cần duyệt",
        },
        exerciseShareReviewed: {
          approved: (exercise: string) => `${exercise} đã có trong thư viện chung.`,
          merged: (exercise: string, target?: string) => `${exercise} đã được gộp vào ${target ?? "một bài có sẵn"}; giáo án của bạn giờ dùng bài đó.`,
          rejected: (exercise: string, note?: string) => `${exercise} vẫn nằm trong thư viện riêng của bạn.${note ? ` Ghi chú: ${note}` : ""}`,
          sharedTitle: "Bài tập đã được dùng chung",
          notSharedTitle: "Bài tập chưa được dùng chung",
        },
        workoutLogged: {
          message: (trainee: string, workout: string) => `${trainee} đã hoàn thành ${workout}.`,
          notes: (notes: string) => ` Ghi chú: ${notes}`,
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
    pushPrompt: {
      body: "Nhắc giờ tập, nhắc bữa ăn và cập nhật từ coach sẽ đến với bạn kể cả khi đã đóng app.",
      dismiss: "Để sau",
      enable: "Bật ngay",
      title: "Bật thông báo",
    },
  },
}
