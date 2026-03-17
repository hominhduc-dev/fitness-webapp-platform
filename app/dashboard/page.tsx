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
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"
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
  const completionProgress = Math.min(100, completionRate)
  const calorieRemaining = mealData.dailyNutrition.targetCalories - mealData.dailyNutrition.totalCalories
  const calorieRemainingValue = Math.max(0, calorieRemaining)
  const focusGroups = workoutData.todayWorkout
    ? Array.from(new Set(workoutData.todayWorkout.exercises.map((exercise) => exercise.exercise.muscleGroup))).slice(0, 3)
    : []
  const isVietnamese = locale === "vi"
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
      height: completed ? 72 : scheduled ? 50 : 24,
      isToday: day === todayDay,
      label,
      scheduled,
    }
  })

  const heroTitle = workoutData.todayWorkout
    ? isVietnamese
      ? "Mọi tín hiệu quan trọng của hôm nay đã nằm trong một dashboard gọn và rõ."
      : "Everything important for today is pulled into one clear dashboard."
    : isVietnamese
      ? "Hôm nay không có buổi tập, nhưng toàn bộ nhịp tuần vẫn đủ rõ để bạn quyết định nhanh."
      : "No session is scheduled today, but the week is still easy to read and act on."
  const heroCopy = workoutData.todayWorkout
    ? isVietnamese
      ? "Xem buổi tập hiện tại, tiến độ tuần, fuel target và bước tiếp theo mà không phải quét qua quá nhiều card."
      : "See the current workout, weekly rhythm, fuel target, and the next move without scanning through a crowded screen."
    : isVietnamese
      ? "Dùng ngày nhẹ hơn để kiểm tra adherence, meals và chuẩn bị cho session kế tiếp."
      : "Use the lighter day to review adherence, meals, and line up the next session."
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
      ? "Không có session hôm nay. Giữ vận động nhẹ và chuẩn bị tốt cho buổi kế tiếp."
      : "No session is scheduled today. Keep movement light and set up the next session well."
    : calorieProgress >= 80
      ? isVietnamese
        ? "Calories hôm nay đang theo kịp mục tiêu, nên bạn có thể vào session với ít ma sát hơn."
        : "Today's calories are on track, so you can enter the session with less friction."
      : isVietnamese
        ? "Fuel target còn thiếu. Một bữa ăn tốt sẽ cải thiện chất lượng buổi tập."
        : "Fuel is still behind target. One solid meal will improve the quality of the session."
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
          ? "Không có buổi tập hôm nay. Mở workout hoặc lịch để lên buổi kế tiếp."
          : "No workout is scheduled today. Open workouts or the schedule to line up the next one.",
        href: "/workout",
        label: isVietnamese ? "Mở workout" : "Open workouts",
      }
  const statCards = [
    {
      helper: messages.dashboard.workoutsCompleted,
      icon: Activity,
      label: messages.dashboard.thisWeek,
      tone: "primary",
      value: `${workoutsThisWeek}/${scheduledThisWeek || 0}`,
    },
    {
      helper: isVietnamese ? "so với kế hoạch tuần" : "against this week's plan",
      icon: Target,
      label: isVietnamese ? "Hoàn thành tuần" : "Weekly completion",
      tone: "cool",
      value: `${completionRate}%`,
    },
    {
      helper: messages.dashboard.loggedThisWeek,
      icon: TrendingUp,
      label: messages.dashboard.totalVolume,
      tone: "neutral",
      value: totalVolume.toLocaleString(),
    },
    {
      helper:
        calorieRemaining > 0
          ? isVietnamese
            ? "calories còn lại hôm nay"
            : "calories remaining today"
          : isVietnamese
            ? "đã đạt target hôm nay"
            : "target reached today",
      icon: Utensils,
      label: messages.dashboard.todaysNutrition,
      tone: "warm",
      value: `${calorieRemainingValue}`,
    },
  ] as const

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(19,73,236,0.08),transparent_22%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)]">
      <Sidebar role="trainee" />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 md:py-6 lg:px-8">
            <div className="space-y-6">
              <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1.35fr)_360px]">
                <div className="relative min-w-0 overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_58%,#eef4ff_100%)] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.25)] sm:p-7">
                  <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_top_right,rgba(19,73,236,0.14),transparent_62%)]" />
                  <div className="relative max-w-3xl">
                    <div className="inline-flex items-center rounded-full border border-primary/12 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      {isVietnamese ? "Trainee dashboard" : "Trainee dashboard"}
                    </div>

                    <h1 className="mt-4 text-[2rem] font-black tracking-tight text-slate-950 sm:text-4xl">
                      {messages.dashboard.welcomeBack}, <span className="text-primary">{firstName}</span>
                    </h1>
                    <p className="mt-3 max-w-3xl text-[1.85rem] font-black leading-tight tracking-tight text-slate-950 sm:text-[2.1rem] sm:leading-[1.08]">
                      {heroTitle}
                    </p>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{heroCopy}</p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href={primaryAction.href}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(19,73,236,0.55)] transition-all hover:-translate-y-0.5 hover:bg-primary/92 sm:w-auto"
                      >
                        {primaryAction.label}
                      </Link>
                      <Link
                        href="/schedule"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:text-primary sm:w-auto"
                      >
                        {isVietnamese ? "Mở lịch tuần" : "Open schedule"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-[22px] border border-white/90 bg-white/88 p-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.18)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{messages.dashboard.nextWorkout}</p>
                        <p className="mt-2 text-xl font-black tracking-tight text-slate-950">{nextWorkout.value}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{nextWorkout.subtitle}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/90 bg-white/88 p-4 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.18)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {isVietnamese ? "Nhịp tuần" : "Weekly rhythm"}
                        </p>
                        <p className="mt-2 text-xl font-black tracking-tight text-slate-950">
                          {activeDaysThisWeek} {isVietnamese ? "ngày active" : "active days"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {isVietnamese ? "Ngày đã có ít nhất một workout log." : "Days with at least one logged workout."}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-primary/14 bg-primary/8 p-4 shadow-[0_18px_38px_-32px_rgba(19,73,236,0.16)] sm:col-span-2 xl:col-span-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/75">
                          {isVietnamese ? "Fuel target" : "Fuel target"}
                        </p>
                        <p className="mt-2 text-xl font-black tracking-tight text-slate-950">{calorieProgress}%</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {calorieRemaining > 0
                            ? isVietnamese
                              ? `${calorieRemainingValue} kcal còn lại để chạm target hôm nay.`
                              : `${calorieRemainingValue} kcal remaining to hit today's target.`
                            : isVietnamese
                              ? "Target calories hôm nay đã đạt."
                              : "Today's calorie target is already met."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {isVietnamese ? "Today's scheduled workout" : "Today's scheduled workout"}
                        </p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                          {workoutData.todayWorkout ? workoutData.todayWorkout.name : nextWorkout.subtitle}
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-primary">
                          {workoutData.todayWorkout ? messages.common.today : nextWorkout.value}
                        </p>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-600">
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

                    <p className="mt-4 text-sm leading-6 text-slate-600">{primaryAction.description}</p>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-[28px] border border-slate-900/80 bg-slate-950 p-5 text-white shadow-[0_24px_55px_-34px_rgba(15,23,42,0.46)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      {isVietnamese ? "Today's signal" : "Today's signal"}
                    </p>
                    <h2 className="mt-2 text-[1.65rem] font-black tracking-tight">{signalHeadline}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/72">{signalCopy}</p>

                    <div className="mt-5 space-y-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/70">{isVietnamese ? "Fuel target" : "Fuel target"}</span>
                          <span className="font-semibold text-white">{calorieProgress}%</span>
                        </div>
                        <Progress value={calorieProgress} className="h-2.5 bg-white/12 [&_[data-slot=progress-indicator]]:bg-white" />
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/70">{isVietnamese ? "Weekly completion" : "Weekly completion"}</span>
                          <span className="font-semibold text-white">{completionRate}%</span>
                        </div>
                        <Progress value={completionProgress} className="h-2.5 bg-white/12 [&_[data-slot=progress-indicator]]:bg-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className={cn(
                      "rounded-[24px] border p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.18)]",
                      card.tone === "primary" && "border-primary/12 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]",
                      card.tone === "cool" && "border-blue-200/80 bg-[linear-gradient(180deg,#f5f9ff_0%,#ffffff_100%)]",
                      card.tone === "neutral" && "border-slate-200/80 bg-white",
                      card.tone === "warm" && "border-amber-200/80 bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                        <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{card.value}</p>
                        <p className="mt-1 text-sm text-slate-600">{card.helper}</p>
                      </div>
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          card.tone === "primary" && "bg-primary/10 text-primary",
                          card.tone === "cool" && "bg-blue-100 text-blue-600",
                          card.tone === "neutral" && "bg-slate-100 text-slate-700",
                          card.tone === "warm" && "bg-amber-100 text-amber-600",
                        )}
                      >
                        <card.icon className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1.18fr)_360px]">
                <div className="space-y-6">
                  <TodayWorkout workout={workoutData.todayWorkout} />
                  <RecentActivity logs={workoutData.recentLogs} />
                </div>

                <div className="space-y-6">
                  <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {isVietnamese ? "Nhịp tuần" : "Weekly rhythm"}
                        </p>
                        <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                          {isVietnamese ? "Giữ cả tuần dễ đọc và dễ quyết định" : "Keep the week easy to read"}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {isVietnamese
                            ? `${workoutsThisWeek}/${scheduledThisWeek || 0} buổi đã hoàn thành. Session kế tiếp là ${nextWorkout.subtitle}.`
                            : `${workoutsThisWeek}/${scheduledThisWeek || 0} sessions completed. Next up is ${nextWorkout.subtitle}.`}
                        </p>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm">
                        <Flame className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
                      {weeklyBars.map((bar, index) => (
                        <div key={`${bar.label}-${index}`} className="flex flex-col items-center gap-2">
                          <div
                            className={cn(
                              "flex h-20 w-full items-end justify-center rounded-[16px] border px-1.5 py-2 sm:h-24 sm:rounded-[18px] sm:px-2",
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
                          <span className={cn("text-[10px] font-semibold sm:text-[11px]", bar.isToday ? "text-primary" : "text-slate-500")}>
                            {bar.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <Link
                      href="/schedule"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      {isVietnamese ? "Mở lịch tuần" : "Open schedule"}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="rounded-[30px] border border-white/80 bg-white/92 p-5 shadow-[0_22px_55px_-36px_rgba(15,23,42,0.22)]">
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {isVietnamese ? "Quick actions" : "Quick actions"}
                      </p>
                      <p className="mt-1 text-lg font-black tracking-tight text-slate-950">
                        {isVietnamese ? "Một CTA rõ ràng, các bước phụ trợ ngay dưới" : "One clear action, support moves right below"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {isVietnamese
                          ? "Đi thẳng vào buổi tập chính, rồi dùng ba action còn lại để giữ tuần trôi mượt."
                          : "Jump into the primary workout first, then use the support actions to keep the week moving."}
                      </p>
                    </div>
                    <QuickActions primaryAction={primaryAction} />
                  </div>

                  <NutritionSummary nutrition={mealData.dailyNutrition} />
                </div>
              </section>
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
