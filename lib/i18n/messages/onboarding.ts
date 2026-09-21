export const onboardingMessages = {
  en: {
    onboarding: {
      activityAccent: "How active",
      activityQuestion: "How active are you outside the gym?",
      activityTitle: "Almost done.",
      back: "Back",
      birthDateAccent: "When",
      birthDateInvalid: "Enter a valid date of birth in the past.",
      birthDateQuestion: "When were you born?",
      birthDateTitle: "We'll size your plan around your body stats.",
      finish: "Build my program",
      goalsAccent: "training for",
      goalsQuestion: "What are you training for?",
      goalsTitle: "Last one.",
      heightAccent: "How tall",
      heightInvalid: "Enter a height between 50 and 300 cm.",
      heightTitle: "Two quick body stats and we are set.",
      heightQuestion: "How tall are you?",
      next: "Next",
      saveError: "We could not save your profile. Please try again.",
      productTour: {
        dashboard: {
          checkIn: {
            title: "Daily check-in",
            body: "Start here to check recovery, readiness and what today should look like.",
          },
          quickActions: {
            title: "Quick actions",
            body: "Jump straight into the most common logs and trainee tools without hunting through tabs.",
          },
          readiness: {
            title: "Readiness",
            body: "Use this card to understand sleep, fatigue, stress and soreness before training.",
          },
          nutrition: {
            title: "Nutrition",
            body: "Track calories, macros and meal progress for the day at a glance.",
          },
          todayWorkout: {
            title: "Today's workout",
            body: "See the next workout or rest-day guidance and open the plan when you are ready.",
          },
          weeklyProgress: {
            title: "Weekly progress",
            body: "Review completed sessions, active days, volume and the next scheduled workout.",
          },
          weeklyVolume: {
            title: "Weekly muscle volume",
            body: "Check hard sets by muscle group and spot when a muscle is near or above its recovery range.",
          },
          trainingMetrics: {
            title: "Training metrics",
            body: "Tap this info button to understand hard sets, MEV, MAV, MRV and e1RM.",
          },
          recentActivity: {
            title: "Recent activity",
            body: "Use recent sessions to quickly review what was completed and when.",
          },
        },
        coachPrograms: {
          library: {
            title: "Program library",
            body: "Create, import and maintain reusable program templates here.",
          },
          byClient: {
            title: "By client",
            body: "Switch to By client to see only assigned programs grouped under each trainee.",
          },
          actions: {
            title: "Assign with intent",
            body: "Open a program to review it, adjust a personalized copy or assign it to a client.",
          },
        },
        coachClientDetail: {
          overview: {
            title: "Client snapshot",
            body: "Overview gives you a quick read on training consistency, body metrics and recent sessions.",
          },
          tabs: {
            title: "Nutrition and logs",
            body: "Use Nutrition and Workout logs to inspect the details behind the weekly picture.",
          },
          actions: {
            title: "Coach actions",
            body: "Assign programs, add check-ins and keep the client's next action close at hand.",
          },
        },
        coachWorkoutBuilder: {
          week: {
            title: "Build the week",
            body: "Add workouts to each week and place them on the days your client will train.",
          },
          exercises: {
            title: "Prescribe clearly",
            body: "Choose exercises, sets, reps, rest and intensity so the plan is ready to execute.",
          },
          save: {
            title: "Save, then assign",
            body: "Save the program when it is ready, then assign it from the program library or client detail.",
          },
        },
        traineeWorkout: {
          today: {
            title: "Your training plan",
            body: "Find today's session and the rest of your assigned workouts in one place.",
          },
          list: {
            title: "Log every set",
            body: "Start a workout, record reps and weight, and keep the plan connected to your real performance.",
          },
          actions: {
            title: "Adapt when needed",
            body: "You can replace an exercise during a session and keep the rest of your workout moving.",
          },
        },
        traineeWorkoutSession: {
          stats: {
            title: "Your session so far",
            body: "Elapsed time, sets completed, volume lifted and how many exercises are planned — all live as you log.",
          },
          exercise: {
            title: "One block per exercise",
            body: "A block turns your theme colour once every set inside it is ticked, so you can see what is left at a glance.",
          },
          set: {
            title: "Log a set",
            body: "Enter weight and reps, then tick it off. Previous shows what you did last time, so you know what to beat.",
          },
          finish: {
            title: "Finish when you are done",
            body: "Saving logs the session and takes you back to your dashboard. It works offline too — the log uploads once you are back on.",
          },
        },
        traineeNutrition: {
          summary: {
            title: "Plan your day",
            body: "See planned meals and your daily calorie and macro targets at a glance.",
          },
          log: {
            title: "Log what you eat",
            body: "Record meals and portions so your nutrition summary reflects the real day.",
          },
          actions: {
            title: "Adjust with context",
            body: "Use the daily totals to make small, practical changes instead of chasing perfection.",
          },
        },
        traineeProgress: {
          overview: {
            title: "See the trend",
            body: "Progress brings training, strength, body weight and consistency into one view.",
          },
          metrics: {
            title: "Read the signals",
            body: "Use volume and recovery metrics to understand whether your current workload is sustainable.",
          },
          actions: {
            title: "Make the next decision",
            body: "Look for trends over time before changing your plan after a single session.",
          },
        },
        traineeSchedule: {
          calendar: {
            title: "Your training calendar",
            body: "See upcoming workouts, rest days and completed sessions across the week.",
          },
          week: {
            title: "Plan around real life",
            body: "Use the schedule to understand what is next and keep your training rhythm realistic.",
          },
          actions: {
            title: "Stay flexible",
            body: "A missed day is information, not failure. Return to the next useful session and keep going.",
          },
        },
        controls: {
          next: "Next",
          back: "Back",
          done: "Done",
          progress: (current: string, total: string) => `${current} / ${total}`,
        },
      },
      sexAccent: "sex?",
      sexFemale: "Female",
      sexMale: "Male",
      sexQuestion: "To start, what is your sex?",
      sexTitle: "Welcome! Let's set up your training.",
      skip: "Set this up later",
      stepCounter: (current: number, total: number) => `Step ${current} of ${total}`,
      weightAccent: "current weight",
      weightInvalid: "Enter a weight between 20 and 500.",
      weightQuestion: "What's your current weight?",
      weightTitle: "This becomes the starting point of your progress chart.",
    },
  },
  vi: {
    onboarding: {
      activityAccent: "vận động nhiều",
      activityQuestion: "Ngoài giờ tập, bạn vận động nhiều không?",
      activityTitle: "Sắp xong rồi.",
      back: "Quay lại",
      birthDateAccent: "ngày nào",
      birthDateInvalid: "Nhập ngày sinh hợp lệ trong quá khứ.",
      birthDateQuestion: "Bạn sinh ngày nào?",
      birthDateTitle: "Chương trình sẽ được cân theo chỉ số cơ thể của bạn.",
      finish: "Tạo chương trình cho tôi",
      goalsAccent: "để làm gì",
      goalsQuestion: "Bạn tập để làm gì?",
      goalsTitle: "Câu cuối.",
      heightAccent: "cao bao nhiêu",
      heightInvalid: "Nhập chiều cao từ 50 đến 300 cm.",
      heightTitle: "Hai chỉ số cơ thể nhanh là xong.",
      heightQuestion: "Bạn cao bao nhiêu?",
      next: "Tiếp tục",
      saveError: "Chưa lưu được hồ sơ. Hãy thử lại.",
      productTour: {
        dashboard: {
          checkIn: {
            title: "Check-in hằng ngày",
            body: "Bắt đầu ở đây để xem phục hồi, mức sẵn sàng và kế hoạch phù hợp cho hôm nay.",
          },
          quickActions: {
            title: "Thao tác nhanh",
            body: "Đi thẳng tới các thao tác thường dùng mà không cần tìm qua nhiều tab.",
          },
          readiness: {
            title: "Mức sẵn sàng",
            body: "Theo dõi giấc ngủ, mệt mỏi, căng thẳng và đau nhức trước khi tập.",
          },
          nutrition: {
            title: "Dinh dưỡng",
            body: "Xem nhanh calories, macro và tiến độ các bữa trong ngày.",
          },
          todayWorkout: {
            title: "Buổi tập hôm nay",
            body: "Xem buổi tập kế tiếp hoặc gợi ý ngày nghỉ, rồi mở giáo án khi bạn sẵn sàng.",
          },
          weeklyProgress: {
            title: "Tiến độ tuần",
            body: "Xem số buổi đã hoàn thành, ngày hoạt động, volume và buổi tập kế tiếp.",
          },
          weeklyVolume: {
            title: "Volume cơ theo tuần",
            body: "Theo dõi hard set theo từng nhóm cơ và nhận biết khi cơ gần hoặc vượt vùng phục hồi.",
          },
          trainingMetrics: {
            title: "Chỉ số tập luyện",
            body: "Bấm nút thông tin để hiểu hard set, MEV, MAV, MRV và e1RM.",
          },
          recentActivity: {
            title: "Hoạt động gần đây",
            body: "Xem nhanh các buổi vừa hoàn thành và thời điểm đã tập.",
          },
        },
        coachPrograms: {
          library: {
            title: "Thư viện chương trình",
            body: "Tạo, import và quản lý các program template có thể tái sử dụng tại đây.",
          },
          byClient: {
            title: "Theo client",
            body: "Chuyển sang Theo client để chỉ xem chương trình đã assign, được nhóm theo từng trainee.",
          },
          actions: {
            title: "Assign có chủ đích",
            body: "Mở program để kiểm tra, chỉnh bản cá nhân hóa hoặc assign cho client.",
          },
        },
        coachClientDetail: {
          overview: {
            title: "Tổng quan client",
            body: "Overview cho bạn đọc nhanh về độ đều, chỉ số cơ thể và các buổi tập gần đây.",
          },
          tabs: {
            title: "Dinh dưỡng và log",
            body: "Dùng Nutrition và Workout logs để xem chi tiết phía sau bức tranh trong tuần.",
          },
          actions: {
            title: "Thao tác coach",
            body: "Assign program, thêm check-in và giữ hành động kế tiếp của client trong tầm tay.",
          },
        },
        coachWorkoutBuilder: {
          week: {
            title: "Xây tuần tập",
            body: "Thêm workout vào từng tuần và đặt vào ngày client sẽ tập.",
          },
          exercises: {
            title: "Kê bài rõ ràng",
            body: "Chọn bài, set, rep, nghỉ và cường độ để giáo án sẵn sàng thực hiện.",
          },
          save: {
            title: "Lưu rồi assign",
            body: "Lưu program khi đã sẵn sàng, sau đó assign từ thư viện hoặc trang chi tiết client.",
          },
        },
        traineeWorkout: {
          today: {
            title: "Kế hoạch tập",
            body: "Xem buổi hôm nay và các workout được assign ở cùng một chỗ.",
          },
          list: {
            title: "Log từng set",
            body: "Bắt đầu buổi tập, ghi reps và weight để giáo án phản ánh hiệu suất thật.",
          },
          actions: {
            title: "Linh hoạt khi cần",
            body: "Bạn có thể đổi bài trong buổi tập và vẫn tiếp tục phần còn lại.",
          },
        },
        traineeWorkoutSession: {
          stats: {
            title: "Buổi tập đang diễn ra",
            body: "Thời gian, số set đã xong, tổng khối lượng và số bài đã lên kế hoạch — cập nhật ngay khi bạn ghi.",
          },
          exercise: {
            title: "Mỗi bài một khối",
            body: "Khối sẽ đổi sang màu theme khi mọi set bên trong được tick, nên bạn nhìn là biết còn bài nào.",
          },
          set: {
            title: "Ghi một set",
            body: "Nhập tạ và số rep rồi tick hoàn thành. Cột Previous cho biết lần trước bạn làm bao nhiêu để lấy mốc vượt qua.",
          },
          finish: {
            title: "Bấm hoàn tất khi xong",
            body: "Lưu xong sẽ ghi lại buổi tập và đưa bạn về dashboard. Mất mạng vẫn dùng được — log sẽ tự tải lên khi có mạng lại.",
          },
        },
        traineeNutrition: {
          summary: {
            title: "Lên kế hoạch trong ngày",
            body: "Xem các bữa đã lên kế hoạch cùng mục tiêu calories và macro trong ngày.",
          },
          log: {
            title: "Ghi lại bữa ăn",
            body: "Ghi món và khẩu phần để tổng kết dinh dưỡng phản ánh đúng ngày thực tế.",
          },
          actions: {
            title: "Điều chỉnh có ngữ cảnh",
            body: "Dựa vào tổng ngày để chỉnh nhỏ và thực tế, thay vì cố hoàn hảo từng bữa.",
          },
        },
        traineeProgress: {
          overview: {
            title: "Xem xu hướng",
            body: "Progress gom tập luyện, sức mạnh, cân nặng và độ đều vào một màn hình.",
          },
          metrics: {
            title: "Đọc tín hiệu",
            body: "Dùng volume và phục hồi để hiểu workload hiện tại có bền vững không.",
          },
          actions: {
            title: "Ra quyết định kế tiếp",
            body: "Nhìn xu hướng theo thời gian trước khi đổi kế hoạch chỉ vì một buổi tập.",
          },
        },
        traineeSchedule: {
          calendar: {
            title: "Lịch tập của bạn",
            body: "Xem workout sắp tới, ngày nghỉ và các buổi đã hoàn thành trong tuần.",
          },
          week: {
            title: "Lên lịch theo đời sống thật",
            body: "Dùng lịch để biết bước kế tiếp và giữ nhịp tập thực tế.",
          },
          actions: {
            title: "Giữ sự linh hoạt",
            body: "Lỡ một ngày là dữ liệu, không phải thất bại. Quay lại buổi hữu ích kế tiếp và tiếp tục.",
          },
        },
        controls: {
          next: "Tiếp",
          back: "Quay lại",
          done: "Xong",
          progress: (current: string, total: string) => `${current} / ${total}`,
        },
      },
      sexAccent: "giới tính",
      sexFemale: "Nữ",
      sexMale: "Nam",
      sexQuestion: "Đầu tiên, giới tính của bạn?",
      sexTitle: "Chào bạn! Cùng thiết lập hành trình tập luyện nhé.",
      skip: "Để sau",
      stepCounter: (current: number, total: number) => `Bước ${current}/${total}`,
      weightAccent: "Cân nặng hiện tại",
      weightInvalid: "Nhập cân nặng từ 20 đến 500.",
      weightQuestion: "Cân nặng hiện tại của bạn?",
      weightTitle: "Đây sẽ là mốc khởi đầu trên biểu đồ tiến độ.",
    },
  },
} as const
