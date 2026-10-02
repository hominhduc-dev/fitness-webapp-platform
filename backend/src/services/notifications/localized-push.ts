import { NotificationType, type Notification, type Prisma } from "@prisma/client"

type PushLocale = "en" | "vi"

function metadataRecord(metadata: Prisma.JsonValue) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
}

function text(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function number(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function clockTime(value: string, locale: PushLocale) {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return value
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, Number(match[1]), Number(match[2]))))
}

/** Trainee notes carried by a finished session, as "Exercise: note; ...". */
function exerciseNotesText(metadata: Record<string, unknown>) {
  const entries = Array.isArray(metadata.exerciseNotes) ? metadata.exerciseNotes : []
  return entries
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return []
      const { exerciseName, note } = entry as { exerciseName?: unknown; note?: unknown }
      return typeof exerciseName === "string" && typeof note === "string" && note.trim()
        ? [`${exerciseName}: ${note.trim()}`]
        : []
    })
    .join("; ")
}

function elapsedSince(startedAt: string, locale: PushLocale, now: Date) {
  const milliseconds = Math.max(60_000, now.getTime() - new Date(startedAt).getTime())
  const hours = Math.floor(milliseconds / 3_600_000)
  const value = hours >= 1 ? hours : Math.floor(milliseconds / 60_000)
  const unit = hours >= 1 ? "hour" : "minute"
  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(-value, unit)
}

function localizedNotificationCopy(
  notification: Pick<Notification, "message" | "metadata" | "title" | "type">,
  locale: PushLocale,
  now = new Date(),
) {
  const metadata = metadataRecord(notification.metadata)
  const fallback = { body: notification.message, title: notification.title }
  const isVi = locale === "vi"

  switch (notification.type) {
    case NotificationType.program_assigned: {
      const program = text(metadata, "programName")
      return program ? {
        body: isVi ? `Coach đã giao chương trình ${program}.` : `Your coach assigned ${program}.`,
        title: isVi ? "Chương trình mới" : "New program assigned",
      } : fallback
    }
    case NotificationType.program_updated: {
      const target = text(metadata, "adjustedTarget")
      return target ? {
        body: isVi ? `Coach đã điều chỉnh ${target}.` : `${target} has been adjusted by your coach.`,
        title: isVi ? "Coach đã cập nhật chương trình" : "Coach updated your program",
      } : fallback
    }
    case NotificationType.workout_session_open: {
      const workout = text(metadata, "workoutName")
      const startedAt = text(metadata, "startedAt")
      if (!workout || !startedAt) return fallback
      const elapsed = elapsedSince(startedAt, locale, now)
      return {
        body: isVi
          ? `Bạn đã bắt đầu ${workout} ${elapsed}. Hoàn thành hoặc tiếp tục nhé?`
          : `You started ${workout} ${elapsed}. Finish or resume it?`,
        title: isVi ? "Buổi tập chưa hoàn thành" : "Workout still open",
      }
    }
    case NotificationType.weight_reminder:
      return isVi
        ? { body: "Ghi nhanh cân nặng để biểu đồ luôn chính xác.", title: "Đến giờ ghi cân nặng" }
        : { body: "A quick check-in keeps your trend accurate.", title: "Time to log your weight" }
    case NotificationType.check_in_reminder:
      return isVi
        ? { body: "Hôm nay bạn cảm thấy thế nào?", title: "Check-in buổi sáng" }
        : { body: "How are you feeling today?", title: "Morning check-in" }
    case NotificationType.meal_reminder: {
      const mealType = text(metadata, "mealType")
      const labels = isVi
        ? { breakfast: "bữa sáng", dinner: "bữa tối", lunch: "bữa trưa", snack: "bữa phụ" }
        : { breakfast: "breakfast", dinner: "dinner", lunch: "lunch", snack: "snack" }
      const meal = mealType && mealType in labels ? labels[mealType as keyof typeof labels] : undefined
      return meal ? {
        body: isVi ? `Đừng quên ghi lại ${meal} nhé.` : `Don't forget to log your ${meal}.`,
        title: isVi ? `Nhắc ${meal}` : `${meal[0].toUpperCase()}${meal.slice(1)} reminder`,
      } : fallback
    }
    case NotificationType.workout_reminder: {
      const workout = text(metadata, "workoutName")
      const time = text(metadata, "time")
      return workout && time ? {
        body: isVi
          ? `${workout} được lên lịch lúc ${clockTime(time, locale)}.`
          : `${workout} is scheduled at ${clockTime(time, locale)}.`,
        title: isVi ? "Sắp đến giờ tập" : "Workout starts soon",
      } : fallback
    }
    case NotificationType.coach_weekly_review: {
      const traineeCount = number(metadata, "traineeCount")
      const workoutTotal = number(metadata, "workoutTotal")
      if (traineeCount === undefined || workoutTotal === undefined) return fallback
      const rows = Array.isArray(metadata.trainees)
        ? metadata.trainees as Array<{ name?: unknown; workouts?: unknown }>
        : []
      const idle = rows.filter((row) => row.workouts === 0 && typeof row.name === "string")
      const names = idle.slice(0, 3).map((row) => row.name).join(", ")
      const more = idle.length > 3 ? ` +${idle.length - 3}` : ""
      if (isVi) {
        return {
          body: `${traineeCount} học viên đã ghi ${workoutTotal} buổi tập trong tuần này.${idle.length ? ` ${idle.length} học viên chưa tập: ${names}${more}.` : ""} Xem lại số liệu của học viên nhé.`,
          title: "Tổng kết tuần của học viên",
        }
      }
      const subject = traineeCount === 1 ? "Your trainee" : `Your ${traineeCount} trainees`
      return {
        body: `${subject} logged ${workoutTotal} workout${workoutTotal === 1 ? "" : "s"} this week.${idle.length ? ` ${idle.length === 1 ? "1 hasn't" : `${idle.length} haven't`} trained yet: ${names}${more}.` : ""} Review their progress.`,
        title: "Weekly trainee review",
      }
    }
    case NotificationType.coach_trainee_alert: {
      const trainee = text(metadata, "traineeName")
      const kind = text(metadata, "kind")
      if (!trainee) return fallback
      const title = isVi ? `${trainee} cần bạn xem` : `${trainee} needs a look`
      if (kind === "missed_workouts") {
        const completed = number(metadata, "completed")
        const planned = number(metadata, "planned")
        if (completed === undefined || planned === undefined) return fallback
        return {
          body: isVi
            ? `Hoàn thành ${completed}/${planned} buổi theo kế hoạch trong 7 ngày qua.`
            : `Completed ${completed} of ${planned} planned sessions in the last 7 days.`,
          title,
        }
      }
      if (kind === "low_readiness") {
        const days = number(metadata, "days")
        const average = number(metadata, "averageReadiness")
        if (days === undefined || average === undefined) return fallback
        return {
          body: isVi
            ? `Readiness dưới 50 suốt ${days} ngày (trung bình ${average}). Cân nhắc giảm tải.`
            : `Readiness below 50 for ${days} days (avg ${average}). Consider easing the load.`,
          title,
        }
      }
      if (kind === "plateau") {
        const exercises = Array.isArray(metadata.exercises)
          ? metadata.exercises.filter((entry): entry is string => typeof entry === "string")
          : []
        if (exercises.length === 0) return fallback
        return {
          body: isVi
            ? `Không có PR e1RM, tạ hay rep ở ${exercises.join(", ")} trong 3 tuần.`
            : `No e1RM, weight or rep PR on ${exercises.join(", ")} in 3 weeks.`,
          title,
        }
      }
      return fallback
    }
    case NotificationType.general: {
      const applicant = text(metadata, "applicantName")
      const pending = Number(metadata.pendingCount ?? 1)
      if (text(metadata, "kind") === "coach_signup_pending" && applicant) {
        const others = Math.max(pending - 1, 0)
        return {
          body: isVi
            ? `${applicant} vừa đăng ký làm coach.${others > 0 ? ` Còn ${others} hồ sơ khác đang chờ.` : " Chạm để duyệt."}`
            : `${applicant} applied to be a coach.${others > 0 ? ` ${others} more ${others === 1 ? "is" : "are"} waiting.` : " Tap to review."}`,
          title: isVi ? "Hồ sơ coach mới cần duyệt" : "New coach application",
        }
      }
      const coach = text(metadata, "coachName")
      const exercise = text(metadata, "exerciseName")
      if (text(metadata, "kind") === "exercise_share_pending" && coach && exercise) {
        const others = Math.max(pending - 1, 0)
        return {
          body: isVi
            ? `${coach} đề xuất ${exercise} vào thư viện chung.${others > 0 ? ` Còn ${others} bài khác đang chờ.` : " Chạm để duyệt."}`
            : `${coach} suggested ${exercise} for the shared library.${others > 0 ? ` ${others} more ${others === 1 ? "is" : "are"} waiting.` : " Tap to review."}`,
          title: isVi ? "Bài tập cần duyệt" : "Exercise to review",
        }
      }
      const trainee = text(metadata, "traineeName")
      const oldExercise = text(metadata, "oldExerciseName")
      const newExercise = text(metadata, "newExerciseName")
      if (text(metadata, "kind") === "trainee_swapped_exercise" && trainee && oldExercise && newExercise) {
        const program = text(metadata, "programName")
        return {
          body: isVi
            ? `${trainee} đổi ${oldExercise} → ${newExercise}${program ? ` trong ${program}` : ""}. Chạm để duyệt.`
            : `${trainee} swapped ${oldExercise} → ${newExercise}${program ? ` in ${program}` : ""}. Tap to review.`,
          title: isVi ? "Yêu cầu đổi bài tập" : "Exercise swap request",
        }
      }
      if (text(metadata, "kind") === "exercise_share_reviewed" && exercise) {
        const decision = text(metadata, "decision")
        const target = text(metadata, "targetName")
        const note = text(metadata, "note")
        if (decision === "approved") {
          return {
            body: isVi ? `${exercise} đã có trong thư viện chung.` : `${exercise} is now in the shared library.`,
            title: isVi ? "Bài tập đã được dùng chung" : "Exercise shared",
          }
        }
        if (decision === "merged") {
          return {
            body: isVi
              ? `${exercise} đã được gộp vào ${target ?? "một bài có sẵn"}; giáo án của bạn giờ dùng bài đó.`
              : `${exercise} was merged into ${target ?? "a library exercise"}; your programs now use it.`,
            title: isVi ? "Bài tập đã được dùng chung" : "Exercise shared",
          }
        }
        return {
          body: isVi
            ? `${exercise} vẫn nằm trong thư viện riêng của bạn.${note ? ` Ghi chú: ${note}` : ""}`
            : `${exercise} stays in your own library.${note ? ` Note: ${note}` : ""}`,
          title: isVi ? "Bài tập chưa được dùng chung" : "Exercise not shared",
        }
      }
      return fallback
    }
    case NotificationType.workout_logged: {
      const trainee = text(metadata, "traineeName")
      const workout = text(metadata, "workoutName")
      const notes = exerciseNotesText(metadata)
      return trainee && workout ? {
        body: isVi
          ? `${trainee} đã hoàn thành ${workout}.${notes ? ` Ghi chú: ${notes}` : ""}`
          : `${trainee} completed ${workout}.${notes ? ` Notes: ${notes}` : ""}`,
        title: isVi ? `${trainee} vừa ghi buổi tập` : `${trainee} logged a workout`,
      } : fallback
    }
    case NotificationType.coach_request: {
      const kind = text(metadata, "kind")
      const requester = text(metadata, "requesterName")
      const accepter = text(metadata, "accepterName")
      if (kind === "coach_request_received" && requester) {
        return {
          body: isVi ? `${requester} muốn bạn làm coach. Chạm để trả lời.` : `${requester} wants you as their coach. Tap to answer.`,
          title: isVi ? "Yêu cầu học viên mới" : "New trainee request",
        }
      }
      if (kind === "coach_invite_received" && requester) {
        return {
          body: isVi ? `${requester} muốn làm coach của bạn. Chạm để trả lời.` : `${requester} wants to be your coach. Tap to answer.`,
          title: isVi ? "Lời mời kết nối từ coach" : "Coach invitation",
        }
      }
      if (kind === "coach_connection_accepted" && accepter) {
        const invitation = text(metadata, "opener") === "coach"
        return {
          body: isVi
            ? `${accepter} đã chấp nhận ${invitation ? "lời mời" : "yêu cầu"} của bạn.`
            : `${accepter} accepted your ${invitation ? "invitation" : "request"}.`,
          title: isVi ? "Đã kết nối" : "You're connected",
        }
      }
      return fallback
    }
    default:
      return fallback
  }
}

export { localizedNotificationCopy }
export type { PushLocale }
