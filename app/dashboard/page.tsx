import Link from "next/link"
import { Activity, ArrowRight, CalendarDays, Flame, Target, TrendingUp, Utensils } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { NutritionSummary } from "@/components/dashboard/nutrition-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TodayWorkout } from "@/components/dashboard/today-workout"
import { Progress } from "@/components/ui/progress"
import { requireAppSession } from "@/lib/auth/server"
import { fetchMeals, fetchWorkouts } from "@/lib/fitness/api"
import { getServerMessages, getServerLocale } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

const DAY_LABELS = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  vi: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
} as const

function startOfWeek(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - value.getDay())
  return value
}

function resolveNextWorkoutLabel(
  schedule: Record<number, Awaited<ReturnType<typeof fetchWorkouts>>["todayWorkout"]>,
  messages: Awaited<ReturnType<typeof getServerMessages>>,
) {
  const today = new Date().getDay()

  for (let offset = 0; offset < 7; offset += 1) {
    const day = (today + offset) % 7
    const workout = schedule[day]

    if (!workout) {
      continue
    }

    if (offset === 0) {
      return {
        subtitle: workout.name,
        value: messages.common.today,
      }
    }

    if (offset === 1) {
      return {
        subtitle: workout.name,
        value: messages.dashboard.tomorrow,
      }
    }

    return {
      subtitle: workout.name,
      value: messages.dashboard.inDays(offset),
    }
  }

  return {
    subtitle: messages.dashboard.noWorkoutScheduled,
    value: messages.dashboard.rest,
  }
}

export default async function DashboardPage() {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })
  const locale = await getServerLocale()
  const messages = await getServerMessages()
  const [workoutData, mealData] = await Promise.all([fetchWorkouts(accessToken), fetchMeals(accessToken)])
  const weekStart = startOfWeek(new Date())
  const workoutsThisWeek = workoutData.recentLogs.filter((log) => log.startedAt >= weekStart).length
  const scheduledThisWeek = Object.values(workoutData.schedule).filter(Boolean).length
  const totalVolume = workoutData.recentLogs
    .filter((log) => log.startedAt >= weekStart)
    .reduce((sum, log) => sum + (log.totalVolume ?? 0), 0)
  const nextWorkout = resolveNextWorkoutLabel(workoutData.schedule, messages)
  const firstName = profile.name.split(" ")[0]
  const calorieProgress =
    mealData.dailyNutrition.targetCalories > 0
      ? Math.min(100, Math.round((mealData.dailyNutrition.totalCalories / mealData.dailyNutrition.targetCalories) * 100))
      : 0
  const completionRate = scheduledThisWeek > 0 ? Math.round((workoutsThisWeek / scheduledThisWeek) * 100) : 0
  const focusGroups = workoutData.todayWorkout
    ? Array.from(new Set(workoutData.todayWorkout.exercises.map((exercise) => exercise.exercise.muscleGroup))).slice(0, 3)
    : []
  const isVietnamese = locale === "vi"
  const heroBadge = isVietnamese ? "Performance overview" : "Performance overview"
  const heroTitle = workoutData.todayWorkout
    ? isVietnamese
      ? "Bảng điều khiển hôm nay đã đủ dữ liệu để bạn quyết định nhanh."
      : "Today's dashboard is packed with enough signal to make decisions fast."
    : isVietnamese
      ? "Hôm nay chưa có buổi tập, nhưng toàn bộ tín hiệu tuần vẫn ở đây."
      : "No session is scheduled today, but the full weekly signal is still here."
  const heroCopy = workoutData.todayWorkout
    ? isVietnamese
      ? "Từ nhịp tập, fuel target đến buổi tiếp theo, mọi thứ quan trọng nhất đều nằm trong một flow rõ ràng."
      : "From weekly rhythm to fuel target and the next training decision, everything important is pulled into one clear flow."
    : isVietnamese
      ? "Dùng ngày nhẹ hơn để rà lại adherence, meals và chuẩn bị cho buổi kế tiếp."
      : "Use the lighter day to review adherence, meals, and get ahead of the next session."
  const weeklyCompletionLabel = isVietnamese ? "Weekly completion" : "Weekly completion"
  const quickActionsLabel = isVietnamese ? "Quick actions" : "Quick actions"
  const quickActionsCopy = isVietnamese ? "Một hành động nên thắng rõ ràng, các hành động còn lại chỉ hỗ trợ." : "One action should win attention first. Everything else supports it."
  const scheduledWorkoutLabel = isVietnamese ? "Buổi tập đã lên lịch" : "Today's scheduled workout"
  const programSplitLabel = isVietnamese ? "Program split" : "Program split"
  const weeklyRhythmLabel = isVietnamese ? "Nhịp tuần" : "Weekly rhythm"
  const dailySignalLabel = isVietnamese ? "Tín hiệu hôm nay" : "Today's signal"
  const fuelTargetLabel = isVietnamese ? "Fuel target" : "Fuel target"
  const activeDaysLabel = isVietnamese ? "ngày active" : "active days"
  const completedDays = new Set(
    workoutData.recentLogs.filter((log) => log.startedAt >= weekStart).map((log) => log.startedAt.getDay()),
  )
  const activeDaysThisWeek = completedDays.size
  const dayLabels = DAY_LABELS[isVietnamese ? "vi" : "en"]
  const todayDay = new Date().getDay()
  const weeklyBars = dayLabels.map((label, day) => {
    const scheduled = Boolean(workoutData.schedule[day])
    const completed = completedDays.has(day)

    return {
      completed,
      height: completed ? 72 : scheduled ? 50 : 26,
      isToday: day === todayDay,
      label,
      scheduled,
    }
  })
  const summaryFocus = workoutData.todayWorkout
    ? focusGroups.join(" • ") || (isVietnamese ? "Toàn thân" : "Full body")
    : isVietnamese
      ? "Recovery • Mobility • Walk"
      : "Recovery • Mobility • Walk"
  const calorieRemaining = Math.max(0, mealData.dailyNutrition.targetCalories - mealData.dailyNutrition.totalCalories)
  const signalHeadline = !workoutData.todayWorkout
    ? isVietnamese
      ? "Recovery window"
      : "Recovery window"
    : calorieProgress >= 80
      ? isVietnamese
        ? "Ready to train"
        : "Ready to train"
      : calorieProgress >= 45
        ? isVietnamese
          ? "Top up fuel"
          : "Top up fuel"
        : isVietnamese
          ? "Needs fuel"
          : "Needs fuel"
  const signalCopy = !workoutData.todayWorkout
    ? isVietnamese
      ? "Không có session hôm nay. Dùng thời gian này để phục hồi và chuẩn bị cho buổi kế tiếp."
      : "No session is scheduled today. Use the lighter day to recover and prep the next workout."
    : calorieProgress >= 80
      ? isVietnamese
        ? "Calories hôm nay đang theo kịp mục tiêu, bạn có thể vào session với ít ma sát hơn."
        : "Today's calories are on track, so you can enter the session with less friction."
      : calorieProgress >= 45
        ? isVietnamese
          ? "Buổi tập đã rõ, nhưng fuel target còn thiếu. Một bữa ăn tốt sẽ cải thiện phiên tập."
          : "The session is lined up, but fuel is still behind target. One solid meal will improve the session."
        : isVietnamese
          ? "Tín hiệu cho thấy bạn nên ưu tiên nạp thêm năng lượng trước khi tập."
          : "The signal says you should prioritize getting more fuel in before training."
  const primaryAction = workoutData.todayWorkout
    ? {
        description: isVietnamese
          ? `${workoutData.todayWorkout.name} • ${workoutData.todayWorkout.exercises.length} bài • ${workoutData.todayWorkout.duration ?? "?"} phút`
          : `${workoutData.todayWorkout.name} • ${workoutData.todayWorkout.exercises.length} exercises • ${workoutData.todayWorkout.duration ?? "?"} min`,
        href: `/workout/${workoutData.todayWorkout.id}/start`,
        label: isVietnamese ? "Bắt đầu buổi tập" : "Start workout",
      }
    : {
        description: isVietnamese
          ? "Chưa có session hôm nay. Mở thư viện workout để tự tạo hoặc chọn buổi tiếp theo."
          : "No session is scheduled today. Open workouts to build one or line up the next training block.",
        href: "/workout",
        label: isVietnamese ? "Mở workout" : "Open workouts",
      }

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(19,73,236,0.08),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)]">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
              <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_52%,#edf3ff_100%)] p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.25)] sm:p-7">
                <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_top_right,rgba(19,73,236,0.14),transparent_62%)]" />
                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_360px]">
                  <div>
                    <div className="inline-flex items-center rounded-full border border-primary/12 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      {heroBadge}
                    </div>

                    <div className="mt-4 max-w-3xl">
                      <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                        {messages.dashboard.welcomeBack}, <span className="text-primary">{firstName}</span>
                      </h1>
                      <p className="mt-3 max-w-3xl text-2xl font-black tracking-tight text-slate-950 sm:text-[2.15rem] sm:leading-[1.1]">
                        {heroTitle}
                      </p>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{heroCopy}</p>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_240px]">
                      <div className="rounded-[28px] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.2)]">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{weeklyRhythmLabel}</p>
                            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                              {isVietnamese ? "Tuần này đang đi như thế nào" : "How the week is moving"}
                            </h2>
                          </div>
                          <div className="rounded-2xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                            {activeDaysThisWeek} {activeDaysLabel}
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-3">
                          {weeklyBars.map((bar, index) => (
                            <div key={`${bar.label}-${index}`} className="flex flex-col items-center gap-2">
                              <div
                                className={cn(
                                  "flex h-24 w-full items-end justify-center rounded-[18px] border px-2 py-2",
                                  bar.isToday
                                    ? "border-primary/20 bg-primary/8"
                                    : bar.completed
                                      ? "border-emerald-200/80 bg-emerald-50/80"
                                      : bar.scheduled
                                        ? "border-slate-200/80 bg-slate-50/85"
                                        : "border-slate-100 bg-slate-50/45",
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-full max-w-[18px] rounded-full transition-all",
                                    bar.completed ? "bg-emerald-500" : bar.scheduled ? "bg-primary" : "bg-slate-300",
                                  )}
                                  style={{ height: `${bar.height}px` }}
                                />
                              </div>
                              <span className={cn("text-[11px] font-semibold", bar.isToday ? "text-primary" : "text-slate-500")}>
                                {bar.label}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            {isVietnamese ? "Đã hoàn thành" : "Completed"}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                            {isVietnamese ? "Đã lên lịch" : "Scheduled"}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                            {isVietnamese ? "Trống" : "Open"}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-slate-900/80 bg-slate-950 p-5 text-white shadow-[0_24px_55px_-34px_rgba(15,23,42,0.46)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">{dailySignalLabel}</p>
                        <h2 className="mt-2 text-[1.65rem] font-black tracking-tight">{signalHeadline}</h2>
                        <p className="mt-2 text-sm leading-6 text-white/72">{signalCopy}</p>

                        <div className="mt-5 space-y-4">
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-white/70">{fuelTargetLabel}</span>
                              <span className="font-semibold text-white">{calorieProgress}%</span>
                            </div>
                            <Progress value={calorieProgress} className="h-2.5 bg-white/12 [&_[data-slot=progress-indicator]]:bg-white" />
                          </div>
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-white/70">{weeklyCompletionLabel}</span>
                              <span className="font-semibold text-white">{completionRate}%</span>
                            </div>
                            <Progress value={completionRate} className="h-2.5 bg-white/12 [&_[data-slot=progress-indicator]]:bg-primary" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 self-start">
                    <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_42px_-32px_rgba(15,23,42,0.2)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{scheduledWorkoutLabel}</p>
                          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                            {workoutData.todayWorkout ? workoutData.todayWorkout.name : nextWorkout.subtitle}
                          </h2>
                          <p className="mt-1 text-sm font-semibold text-primary">
                            {workoutData.todayWorkout ? messages.common.today : nextWorkout.value}
                          </p>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <CalendarDays className="h-5 w-5" />
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {workoutData.todayWorkout
                          ? `${workoutData.todayWorkout.exercises.length} ${messages.dashboard.exercises} • ${workoutData.todayWorkout.duration ?? "?"} ${messages.dashboard.min}`
                          : messages.dashboard.noWorkoutScheduled}
                      </p>

                      {focusGroups.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {focusGroups.map((group) => (
                            <span key={group} className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
                              {group}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_42px_-32px_rgba(15,23,42,0.2)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{programSplitLabel}</p>
                          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{summaryFocus}</h2>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Target className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {workoutData.todayWorkout
                          ? isVietnamese
                            ? "Dùng card session bên dưới để vào thẳng set hiện tại và theo dõi tiến độ."
                            : "Use the session card below to jump into the current set flow and track progress."
                          : isVietnamese
                            ? "Không có buổi tập hôm nay. Hãy dùng lịch và meals để chuẩn bị cho buổi kế tiếp."
                            : "No workout is scheduled today. Use schedule and meals to prepare for the next session."}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link href="/meals" className="block">
                        <div className="rounded-[22px] border border-amber-200/80 bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)] p-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:border-amber-300/90">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700/75">
                              {messages.dashboard.logMeal}
                            </p>
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                              <Utensils className="h-4.5 w-4.5" />
                            </div>
                          </div>
                          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{mealData.dailyNutrition.totalCalories}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {calorieRemaining > 0
                              ? `${calorieRemaining} kcal ${isVietnamese ? "còn lại hôm nay" : "remaining today"}`
                              : isVietnamese
                                ? "Đã đạt target calories hôm nay"
                                : "Today's calorie target is already met"}
                          </p>
                        </div>
                      </Link>

                      <div className="rounded-[22px] border border-primary/12 bg-[linear-gradient(180deg,#f4f8ff_0%,#ffffff_100%)] p-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/75">{weeklyCompletionLabel}</p>
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Activity className="h-4.5 w-4.5" />
                          </div>
                        </div>
                        <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                          {workoutsThisWeek}/{scheduledThisWeek || 0}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {completionRate}% {isVietnamese ? "hoàn thành lịch tuần" : "completion against this week's plan"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.24)]">
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{quickActionsLabel}</p>
                    <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                      {isVietnamese ? "Một CTA rõ ràng, ba hành động phụ trợ" : "One clear CTA, three support moves"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{quickActionsCopy}</p>
                  </div>
                  <QuickActions primaryAction={primaryAction} />
                </div>

                <div className="rounded-[28px] border border-emerald-200/80 bg-[linear-gradient(135deg,#f3fbf5_0%,#ffffff_64%,#edf9f2_100%)] p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.24)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/75">{messages.dashboard.weeklyStreak}</p>
                      <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">
                        {activeDaysThisWeek}
                        <span className="ml-1 text-xl font-bold text-emerald-600">d</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {isVietnamese
                          ? `${activeDaysThisWeek} ngày bạn đã ghi ít nhất một workout trong tuần này.`
                          : `${activeDaysThisWeek} days this week with at least one workout log.`}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm">
                      <Flame className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-7 gap-2">
                    {weeklyBars.map((bar, index) => (
                      <div key={`${bar.label}-streak-${index}`} className="space-y-2 text-center">
                        <div className="mx-auto h-2.5 w-full rounded-full bg-emerald-100">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              bar.completed ? "bg-emerald-500" : bar.scheduled ? "bg-emerald-300/80" : "bg-transparent",
                            )}
                          />
                        </div>
                        <p className={cn("text-[11px] font-semibold", bar.isToday ? "text-emerald-700" : "text-slate-500")}>{bar.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[24px] border border-primary/12 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.18)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{messages.dashboard.thisWeek}</p>
                        <p className="mt-2 text-4xl font-black tracking-tight text-primary">
                          {workoutsThisWeek}/{scheduledThisWeek || 0}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{messages.dashboard.workoutsCompleted}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Target className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={completionRate} className="h-2.5 bg-primary/12" />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.18)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{messages.dashboard.totalVolume}</p>
                        <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{totalVolume.toLocaleString()}</p>
                        <p className="mt-1 text-sm text-slate-600">{messages.dashboard.loggedThisWeek}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_420px]">
              <TodayWorkout workout={workoutData.todayWorkout} />

              <div className="space-y-6">
                <Link href="/schedule" className="block">
                  <div className="rounded-[30px] border border-primary/14 bg-[linear-gradient(135deg,#ffffff_0%,#f5f9ff_100%)] p-6 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:border-primary/24">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{messages.dashboard.nextWorkout}</p>
                        <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{nextWorkout.value}</p>
                        <p className="mt-1 text-lg font-semibold text-primary">{nextWorkout.subtitle}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                      {isVietnamese ? "Mở lịch tuần" : "Open weekly schedule"}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>

                <NutritionSummary nutrition={mealData.dailyNutrition} />
              </div>
            </div>

            <div className="mt-6">
              <RecentActivity logs={workoutData.recentLogs} />
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
