"use client"

import Link from "next/link"
import { Activity, CalendarDays, ChevronRight, Flame, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { useProgressAnalytics } from "@/lib/queries/progress"

type WeeklyProgressCardProps = {
  activeDays: number
  completedWorkouts: number
  nextWorkout: { subtitle: string; value: string }
  scheduledWorkouts: number
  volumeUnitLabel: string
}

function formatVolume(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value))
}

export function WeeklyProgressCard({
  activeDays,
  completedWorkouts,
  nextWorkout,
  scheduledWorkouts,
  volumeUnitLabel,
}: WeeklyProgressCardProps) {
  const { messages } = useLocale()
  const copy = messages.dashboard
  const query = useProgressAnalytics()
  const weeklyVolume = query.data?.weeklyVolume ?? []
  const totalVolume = weeklyVolume.reduce((sum, point) => sum + point.volume, 0)

  return (
    <section className="glass-card min-w-0 rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{copy.weeklyProgress}</h2>
        <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {copy.viewDetails}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 h-44 w-full">
        {query.isPending ? (
          <Skeleton className="size-full rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyVolume} margin={{ bottom: 0, left: -18, right: 0, top: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickFormatter={formatVolume}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                formatter={(value: number) => [`${value.toLocaleString()} ${volumeUnitLabel}`, copy.volume]}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="volume" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { icon: Activity, label: copy.completed, value: `${completedWorkouts}/${scheduledWorkouts}` },
          { icon: Flame, label: copy.activeDays, value: String(activeDays) },
          { icon: TrendingUp, label: copy.volume, value: `${formatVolume(totalVolume)} ${volumeUnitLabel}` },
          { icon: CalendarDays, label: copy.nextWorkout, value: nextWorkout.value, helper: nextWorkout.subtitle },
        ].map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-xl border border-border bg-surface-subtle p-3">
            <metric.icon className="size-4 text-primary" aria-hidden="true" />
            <p className="mt-2 truncate font-mono text-base font-semibold tnum text-foreground">{metric.value}</p>
            <p className="mt-0.5 truncate text-micro text-muted-foreground">{metric.helper ?? metric.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
