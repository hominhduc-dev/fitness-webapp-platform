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
    case NotificationType.workout_logged: {
      const trainee = text(metadata, "traineeName")
      const workout = text(metadata, "workoutName")
      return trainee && workout ? {
        body: isVi ? `${trainee} đã hoàn thành ${workout}.` : `${trainee} completed ${workout}.`,
        title: isVi ? `${trainee} vừa ghi buổi tập` : `${trainee} logged a workout`,
      } : fallback
    }
    default:
      return fallback
  }
}

export { localizedNotificationCopy }
export type { PushLocale }
