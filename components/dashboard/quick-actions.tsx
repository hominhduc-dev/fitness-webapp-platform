"use client"

import Link from "next/link"
import { ArrowRight, Calendar, Dumbbell, TrendingUp, Utensils } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/providers/locale-provider"

type QuickActionsProps = {
  primaryAction?: {
    description: string
    href: string
    label: string
  }
}

export function QuickActions({ primaryAction }: QuickActionsProps) {
  const { locale, messages } = useLocale()
  const secondaryActions = [
    {
      href: "/meals",
      icon: Utensils,
      label: messages.dashboard.logMeal,
      description: locale === "vi" ? "Cập nhật calories và macros ngay sau mỗi bữa." : "Keep calories and macros aligned through the day.",
      tone: "meal",
    },
    {
      href: "/schedule",
      icon: Calendar,
      label: messages.dashboard.schedule,
      description: locale === "vi" ? "Xem nhịp 7 ngày và chuẩn bị cho buổi kế tiếp." : "Check the next 7 days and line up the next session.",
      tone: "schedule",
    },
    {
      href: "/progress",
      icon: TrendingUp,
      label: messages.dashboard.progress,
      description: locale === "vi" ? "Theo dõi volume, adherence và xu hướng tập luyện." : "Review volume, adherence, and training trends.",
      tone: "progress",
    },
  ] as const
  const resolvedPrimaryAction = primaryAction ?? {
    description: locale === "vi" ? "Đi thẳng vào flow luyện tập chính." : "Jump straight into the core workout flow.",
    href: "/workout",
    label: messages.dashboard.quickWorkout,
  }

  return (
    <div className="space-y-3">
      <Link
        href={resolvedPrimaryAction.href}
        className="group overflow-hidden rounded-[24px] border border-primary/18 bg-[linear-gradient(135deg,#1349ec_0%,#2563eb_55%,#5b8cff_100%)] p-5 text-white shadow-[0_22px_50px_-30px_rgba(19,73,236,0.48)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-32px_rgba(19,73,236,0.56)] active:scale-[0.99]"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/18">
              <Dumbbell className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                {locale === "vi" ? "Hành động chính" : "Primary action"}
              </p>
              <p className="mt-1 text-lg font-bold tracking-tight">{resolvedPrimaryAction.label}</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-white/78">{resolvedPrimaryAction.description}</p>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center self-end rounded-2xl bg-white/14 text-white transition-transform group-hover:translate-x-0.5 sm:self-auto">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>
      </Link>

      {secondaryActions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className={cn(
            "group flex items-center gap-3 rounded-[20px] border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-30px_rgba(15,23,42,0.16)] active:scale-[0.99]",
            action.tone === "meal" &&
              "border-amber-200/80 bg-[linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)] hover:border-amber-300/90",
            action.tone === "schedule" &&
              "border-primary/12 bg-[linear-gradient(180deg,#f4f8ff_0%,#ffffff_100%)] hover:border-primary/24",
            action.tone === "progress" &&
              "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] hover:border-slate-300/90",
          )}
        >
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl transition-colors",
              action.tone === "meal" && "bg-amber-100 text-amber-600 group-hover:bg-amber-200/80",
              action.tone === "schedule" && "bg-primary/10 text-primary group-hover:bg-primary/16",
              action.tone === "progress" && "bg-slate-100 text-slate-700 group-hover:bg-slate-200/80",
            )}
          >
            <action.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight text-slate-950">{action.label}</p>
            <p className="mt-0.5 text-sm leading-6 text-slate-600">{action.description}</p>
          </div>
          <ArrowRight className="h-4.5 w-4.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  )
}
