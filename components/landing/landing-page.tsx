import { Suspense } from "react"
import type React from "react"

import Link from "next/link"
import {
  Apple,
  ArrowRight,
  Dumbbell,
  HeartPulse,
  Sparkles,
  Target,
  Users,
} from "lucide-react"

import { AuthModalLauncher } from "@/components/auth/auth-modal-launcher"
import { LocaleToggle } from "@/components/locale/locale-toggle"
import { Button } from "@/components/ui/button"
import type { AppLocale } from "@/lib/i18n/config"
import type { AppMessages } from "@/lib/i18n/messages"

export function LandingPage({
  locale,
  messages,
}: {
  locale: AppLocale
  messages: AppMessages
}) {
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
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(19,73,236,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_58%,#eef4ff_100%)]" />
        <div className="absolute inset-x-0 top-0 -z-10 h-[360px] bg-[linear-gradient(180deg,rgba(19,73,236,0.06),rgba(19,73,236,0))]" />

        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground sm:h-12 sm:w-12">
              <DumbbellIcon className="h-5 w-5" />
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
              className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 sm:px-5"
            >
              <Link href="/?auth=login" scroll={false}>
                {messages.auth.login}
              </Link>
            </Button>
          </div>
        </header>

        <main>
          <section className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pb-18 lg:pt-10">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-white px-3 py-2 text-xs font-semibold text-primary shadow-sm sm:px-4 sm:text-sm">
                <Sparkles className="h-4 w-4" />
                {messages.landing.badge}
              </div>

              <h1 className="mt-6 max-w-[8.8ch] text-[clamp(3rem,13vw,5.8rem)] font-black leading-[0.92] tracking-[-0.06em] text-slate-950 sm:mt-7">
                <span className="block">{messages.landing.heroLine1}</span>
                <span className="block text-primary">{messages.landing.heroLine2}</span>
                <span className="block">{messages.landing.heroLine3}</span>
                <span className="block">{messages.landing.heroLine4}</span>
              </h1>

              <p className="mt-6 max-w-[36rem] text-base leading-7 text-slate-600 sm:text-[1.18rem] sm:leading-8">
                {messages.landing.description}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-13 w-full rounded-2xl px-7 text-base font-semibold shadow-sm sm:w-auto">
                  <Link href="/?auth=register" scroll={false}>
                    {messages.landing.primaryCta}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-13 w-full rounded-2xl border-slate-200 bg-white px-7 text-base font-semibold shadow-sm hover:bg-slate-50 sm:w-auto"
                >
                  <Link href="/?auth=login" scroll={false}>
                    {messages.landing.secondaryCta}
                  </Link>
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
                {featureItems.map((item) => (
                  <div key={item.title} className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {statItems.map((item) => (
                <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
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
                <h3 className="mt-5 text-3xl font-black tracking-tight">{messages.landing.momentumTitle}</h3>
                <p className="mt-4 text-sm leading-7 text-white/80">{messages.landing.momentumDescription}</p>
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
                  <Button asChild size="lg" className="h-14 w-full rounded-2xl px-8 text-base font-semibold transition-all duration-300 hover:-translate-y-1 sm:w-auto">
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

      <Suspense fallback={null}>
        <AuthModalLauncher />
      </Suspense>
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
