import type React from "react"

import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Activity,
  Apple,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react"

import { AuthModalLauncher } from "@/components/auth/auth-modal-launcher"
import { LocaleToggle } from "@/components/locale/locale-toggle"
import { Button } from "@/components/ui/button"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { getServerAuthState } from "@/lib/auth/server"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

const scheduleDays = [
  { day: "Mon", date: "23" },
  { day: "Tue", date: "24" },
  { day: "Wed", date: "25", active: true },
  { day: "Thu", date: "26" },
]

const exerciseItems = [
  { title: "Flat Bench Press", detail: "4 sets x 8 reps @ 85kg", done: true },
  { title: "Incline DB Press", detail: "3 sets x 10 reps", done: false },
  { title: "Cable Fly", detail: "3 sets x 15 reps", done: false },
]

export default async function Home() {
  const authStatePromise = getServerAuthState()
  const localePromise = getServerLocale()
  const messagesPromise = getServerMessages()
  const authState = await authStatePromise

  if (authState.accessToken && authState.profile) {
    redirect(getRoleLandingPath(authState.profile.role))
  }

  const [locale, messages] = await Promise.all([localePromise, messagesPromise])
  const featureItems = [
    {
      icon: Dumbbell,
      title: locale === "en" ? "Workout tracking with depth" : "Workout tracking có chiều sâu",
      copy:
        locale === "en"
          ? "Log sets, reps, volume, and progression so you always know what is actually moving forward."
          : "Log sets, reps, volume và progression để bạn biết mình đang tiến lên ở đâu.",
      tone: "bg-primary/10 text-primary",
    },
    {
      icon: Apple,
      title: locale === "en" ? "Nutrition tied to performance" : "Nutrition gắn với hiệu suất",
      copy:
        locale === "en"
          ? "Track calories, macros, and meal logging around your goal of gaining, cutting, or maintaining."
          : "Theo dõi calories, macros và meal logging theo mục tiêu tăng cơ, siết mỡ hoặc duy trì.",
      tone: "bg-warning/10 text-warning",
    },
    {
      icon: Users,
      title: locale === "en" ? "Coach connection without fragmentation" : "Coach connection không rời rạc",
      copy:
        locale === "en"
          ? "Get training plans, feedback, and progress updates in a single flow instead of scattered tools."
          : "Nhận lịch tập, feedback và cập nhật tiến độ ngay trong cùng một flow sử dụng.",
      tone: "bg-info/10 text-info",
    },
  ]
  const statItems = [
    { label: messages.landing.metricUsers, value: "50K+", tone: "text-primary" },
    { label: messages.landing.metricWorkouts, value: "1M+", tone: "text-slate-950" },
    { label: messages.landing.metricCoaches, value: "500+", tone: "text-info" },
    { label: messages.landing.metricReviews, value: "4.9★", tone: "text-success" },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(19,73,236,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.14),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f8fafc_54%,#eef4ff_100%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-[680px] bg-[linear-gradient(to_right,rgba(19,73,236,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(19,73,236,0.05)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        <div className="absolute left-1/2 top-28 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-[0_18px_40px_-18px_rgba(19,73,236,0.9)] sm:h-12 sm:w-12">
              <DumbbellIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-tight sm:text-2xl">YeahBuddy</div>
              <div className="hidden text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground sm:block">
                Performance OS
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LocaleToggle compact />
            <Button
              asChild
              variant="ghost"
              className="h-10 rounded-full border border-white/70 bg-white/80 px-3 text-sm font-semibold shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)] backdrop-blur transition-colors hover:bg-primary/10 hover:text-primary sm:px-5"
            >
              <Link href="/?auth=login" scroll={false}>
                {messages.auth.login}
              </Link>
            </Button>
          </div>
        </header>

        <main>
          <section className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pb-20 lg:pt-10">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)] lg:gap-14">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-white/88 px-3 py-2 text-xs font-semibold text-primary shadow-[0_18px_45px_-32px_rgba(19,73,236,0.7)] backdrop-blur sm:px-4 sm:py-2.5 sm:text-sm">
                  <Sparkles className="h-4 w-4" />
                  {messages.landing.badge}
                </div>

                <h1 className="mt-6 max-w-[7.4ch] text-[clamp(3rem,15vw,6.2rem)] font-black leading-[0.9] tracking-[-0.068em] text-slate-950 sm:mt-7 sm:max-w-[8.4ch] lg:max-w-[9.2ch]">
                  <span className="block">{messages.landing.heroLine1}</span>
                  <span className="block bg-[linear-gradient(135deg,#1349ec_0%,#3b82f6_50%,#8baeff_100%)] bg-clip-text text-transparent lg:-mt-1">
                    {messages.landing.heroLine2}
                  </span>
                  <span className="block lg:-mt-1">{messages.landing.heroLine3}</span>
                  <span className="block lg:-mt-1">{messages.landing.heroLine4}</span>
                </h1>

                <p className="mt-6 max-w-[37rem] text-base leading-7 text-slate-600 sm:mt-8 sm:text-[1.28rem] sm:leading-8">
                  {messages.landing.description}
                </p>

                <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 w-full rounded-2xl px-8 text-base font-semibold shadow-[0_22px_45px_-18px_rgba(19,73,236,0.75)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_55px_-18px_rgba(19,73,236,0.72)] sm:w-auto"
                  >
                    <Link href="/?auth=register" scroll={false}>
                      {messages.landing.primaryCta}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-14 w-full rounded-2xl border-white bg-white/85 px-8 text-base font-semibold shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)] transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_26px_60px_-34px_rgba(15,23,42,0.35)] sm:w-auto"
                  >
                    <Link href="/?auth=login" scroll={false}>
                      {messages.landing.secondaryCta}
                    </Link>
                  </Button>
                </div>

                <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3">
                  <div className="group rounded-[1.75rem] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/15 hover:shadow-[0_26px_65px_-34px_rgba(15,23,42,0.34)]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <ShieldCheck className="h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                      {messages.landing.statA}
                    </div>
                    <div className="mt-3 text-2xl font-black text-slate-950">1M+</div>
                    <p className="mt-1 text-sm text-slate-600">{messages.landing.statADescription}</p>
                  </div>
                  <div className="group rounded-[1.75rem] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/15 hover:shadow-[0_26px_65px_-34px_rgba(15,23,42,0.34)] sm:translate-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <Users className="h-4 w-4 text-primary transition-transform duration-300 group-hover:scale-110" />
                      {messages.landing.statB}
                    </div>
                    <div className="mt-3 text-2xl font-black text-slate-950">500+</div>
                    <p className="mt-1 text-sm text-slate-600">{messages.landing.statBDescription}</p>
                  </div>
                  <div className="group rounded-[1.75rem] border border-primary/10 bg-[linear-gradient(160deg,#1349ec_0%,#1e56ff_65%,#3b82f6_100%)] p-4 text-primary-foreground shadow-[0_18px_45px_-24px_rgba(19,73,236,0.85)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_65px_-26px_rgba(19,73,236,0.9)]">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white/75">
                      <CheckCircle2 className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                      {messages.landing.statC}
                    </div>
                    <div className="mt-3 text-2xl font-black">45%</div>
                    <p className="mt-1 text-sm text-white/80">{messages.landing.statCDescription}</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-8 top-0 z-10 hidden w-[240px] -translate-y-1/2 rounded-2xl border border-white/80 bg-white/92 p-4 shadow-[0_22px_55px_-30px_rgba(15,23,42,0.35)] transition-transform duration-500 hover:-translate-y-[55%] xl:block">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{messages.landing.coachReview}</div>
                  <div className="mt-2 max-w-[220px] text-sm font-semibold text-slate-900">
                    {messages.landing.coachReviewText}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/80 bg-white/86 p-4 shadow-[0_35px_90px_-42px_rgba(15,23,42,0.4)] backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_42px_100px_-40px_rgba(15,23,42,0.38)] sm:rounded-[2rem] sm:p-6">
                  <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{messages.landing.performanceCockpit}</div>
                      <div className="mt-1 text-xl font-bold text-slate-950">{messages.landing.weeklySchedule}</div>
                    </div>
                    <div className="w-fit rounded-2xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">Oct 23 - Oct 29</div>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
                    {scheduleDays.map((item) => (
                      <div
                        key={item.day}
                        className={
                          item.active
                            ? "rounded-[1.35rem] bg-primary px-2 py-4 text-center text-primary-foreground shadow-[0_18px_40px_-20px_rgba(19,73,236,0.8)] transition-transform duration-300 hover:-translate-y-1 sm:rounded-3xl sm:px-3"
                            : "rounded-[1.35rem] border border-slate-200 bg-white px-2 py-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/15 hover:shadow-[0_16px_35px_-26px_rgba(15,23,42,0.3)] sm:rounded-3xl sm:px-3"
                        }
                      >
                        <div className={item.active ? "text-xs font-semibold uppercase tracking-[0.2em] text-white/75" : "text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"}>
                          {item.day}
                        </div>
                        <div className={item.active ? "mt-1 text-2xl font-black" : "mt-1 text-2xl font-black text-slate-900"}>
                          {item.date}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[1.65rem] border border-primary/15 bg-[linear-gradient(135deg,#0f3dd1_0%,#1349ec_45%,#3b82f6_100%)] p-4 text-primary-foreground shadow-[0_20px_50px_-30px_rgba(19,73,236,0.75)] transition-transform duration-500 hover:-translate-y-1 sm:rounded-[1.85rem] sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-white/75">
                          <Activity className="h-4 w-4" />
                          {messages.landing.activeNow}
                        </div>
                        <h2 className="mt-3 text-xl font-black tracking-tight sm:text-2xl">Push Day - Hypertrophy</h2>
                        <p className="mt-2 text-sm text-white/80">{messages.landing.target}: Chest, Shoulders, Triceps</p>
                      </div>
                      <div className="w-fit rounded-2xl bg-white/14 px-4 py-3 text-right">
                        <div className="text-3xl font-black">45%</div>
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">{messages.landing.progress}</div>
                      </div>
                    </div>

                    <div className="mt-5 h-3 rounded-full bg-white/20">
                      <div className="h-full w-[45%] rounded-full bg-white" />
                    </div>

                    <div className="mt-5 space-y-3">
                      {exerciseItems.map((exercise, index) => (
                        <div
                          key={exercise.title}
                          className={
                            exercise.done
                              ? "flex items-center gap-3 rounded-2xl bg-white/14 px-4 py-3 transition-all duration-300 hover:bg-white/18"
                              : "flex flex-col items-stretch gap-3 rounded-2xl bg-white px-4 py-3 text-slate-900 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between"
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={
                                exercise.done
                                  ? "flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary"
                                  : "flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary text-sm font-bold text-primary"
                              }
                            >
                              {exercise.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                            </div>
                            <div>
                              <div className={exercise.done ? "font-semibold text-white" : "font-semibold text-slate-900"}>{exercise.title}</div>
                              <div className={exercise.done ? "text-sm text-white/75" : "text-sm text-slate-500"}>{exercise.detail}</div>
                            </div>
                          </div>
                          {!exercise.done ? (
                            <div className="rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground sm:w-auto">
                              {locale === "en" ? "Resume" : "Tiếp tục"}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[1.7rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-34px_rgba(15,23,42,0.3)]">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                        <Apple className="h-4 w-4 text-warning" />
                        {messages.landing.nutritionTarget}
                      </div>
                      <div className="mt-4 space-y-4">
                        <MetricBar label={messages.landing.protein} value="152 / 180g" width="84%" tone="bg-warning" />
                        <MetricBar label={messages.landing.calories} value="2,180 / 2,450" width="78%" tone="bg-primary" />
                      </div>
                    </div>
                    <div className="rounded-[1.7rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-34px_rgba(15,23,42,0.3)]">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                        <CalendarDays className="h-4 w-4 text-info" />
                        {messages.landing.coachConnection}
                      </div>
                      <div className="mt-4 rounded-2xl bg-secondary p-4 text-sm leading-6 text-slate-600">
                        {locale === "en"
                          ? "Coach Alex: keep tomorrow's volume moderate and prioritize controlled tempo on incline press."
                          : "Coach Alex: ngày mai giữ volume vừa phải, ưu tiên kiểm soát tempo ở incline press."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {statItems.map((item) => (
                <div
                  key={item.label}
                  className="group relative overflow-hidden rounded-[1.9rem] border border-white/75 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.35)] backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/15 hover:shadow-[0_28px_65px_-36px_rgba(15,23,42,0.34)]"
                >
                  <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-primary/6 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">{item.label}</div>
                  <div className={`mt-4 text-4xl font-black tracking-tight ${item.tone}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <div className="mb-8 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-4 py-2 text-sm font-semibold text-primary">
                <Target className="h-4 w-4" />
                {messages.landing.sectionBadge}
              </div>
              <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {messages.landing.sectionTitle}
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[2rem] border border-primary/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_26px_65px_-36px_rgba(19,73,236,0.35)] sm:rounded-[2.2rem] sm:p-7">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                  <Dumbbell className="h-4 w-4" />
                  {messages.landing.featureSection}
                </div>
                <div className="mt-7 grid gap-4 sm:grid-cols-3">
                  {featureItems.map((item, index) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.title}
                        className={`group rounded-[1.7rem] border border-slate-200/70 bg-white/92 p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/15 hover:shadow-[0_24px_55px_-34px_rgba(15,23,42,0.3)] ${
                          index === 1 ? "sm:translate-y-3" : index === 2 ? "sm:translate-y-1" : ""
                        }`}
                      >
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${item.tone}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="mt-4 text-lg font-bold text-slate-950">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.copy}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] border border-white/75 bg-[linear-gradient(160deg,#1349ec_0%,#1a53fb_62%,#3b82f6_100%)] p-5 text-primary-foreground shadow-[0_24px_60px_-30px_rgba(19,73,236,0.9)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-30px_rgba(19,73,236,0.88)] sm:rounded-[2.2rem] sm:p-6">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-white/75">
                  <HeartPulse className="h-4 w-4" />
                  {messages.landing.momentumSection}
                </div>
                <h3 className="mt-5 text-3xl font-black tracking-tight">
                  {messages.landing.momentumTitle}
                </h3>
                <p className="mt-4 text-sm leading-7 text-white/80">
                  {messages.landing.momentumDescription}
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#eff3ff_100%)] p-6 shadow-[0_28px_75px_-40px_rgba(15,23,42,0.34)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_80px_-40px_rgba(15,23,42,0.32)] sm:rounded-[2.25rem] sm:p-10 lg:p-12">
              <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/10 blur-[90px]" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm">
                    <Sparkles className="h-4 w-4" />
                    {messages.landing.finalBadge}
                  </div>
                  <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    {messages.landing.finalTitle}
                  </h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Button
                    asChild
                    size="lg"
                    className="h-14 w-full rounded-2xl px-8 text-base font-semibold transition-all duration-300 hover:-translate-y-1 sm:w-auto"
                  >
                    <Link href="/?auth=register" scroll={false}>
                      {messages.landing.finalPrimaryCta}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-14 w-full rounded-2xl border-white bg-white/90 px-8 text-base font-semibold transition-all duration-300 hover:-translate-y-1 hover:bg-white sm:w-auto"
                  >
                    <Link href="/?auth=login" scroll={false}>
                      {messages.landing.finalSecondaryCta}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <AuthModalLauncher />
    </div>
  )
}

function MetricBar({ label, value, width, tone }: { label: string; value: string; width: string; tone: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${tone}`} style={{ width }} />
      </div>
    </div>
  )
}

function DumbbellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14.4 14.4 9.6 9.6" />
      <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.828-2.829l6.364-6.364a2 2 0 1 1 2.829 2.828l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
      <path d="m21.5 21.5-1.4-1.4" />
      <path d="M3.9 3.9 2.5 2.5" />
      <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.828 2.829z" />
    </svg>
  )
}
