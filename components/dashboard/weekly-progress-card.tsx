"use client"

import Link from "next/link"
import { Activity, CalendarDays, ChevronRight, Flame, TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

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
  // The last seven days, ending today.
  const weeklyVolume = query.data?.weeklyVolume ?? []
  const totalVolume = weeklyVolume.reduce((sum, point) => sum + point.volume, 0)

  return (
    <section className="glass-card h-full min-w-0 rounded-2xl border border-border bg-card p-3.5 lg:p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{copy.weeklyProgress}</h2>
        <Link href="/progress" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {copy.viewDetails}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-2 h-24 w-full md:h-28 lg:h-16">
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
              <Bar dataKey="volume" radius={[6, 6, 0, 0]} maxBarSize={32}>
                {weeklyVolume.map((point, index) => (
                  // Today stands out; the days before it recede.
                  <Cell
                    key={`${point.day}-${index}`}
                    fill="var(--primary)"
                    fillOpacity={index === weeklyVolume.length - 1 ? 1 : 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          { icon: Activity, label: copy.completed, value: `${completedWorkouts}/${scheduledWorkouts}` },
          { icon: Flame, label: copy.activeDays, value: String(activeDays) },
          { icon: TrendingUp, label: copy.volume, value: `${formatVolume(totalVolume)} ${volumeUnitLabel}` },
          { icon: CalendarDays, label: copy.nextWorkout, value: nextWorkout.value, helper: nextWorkout.subtitle },
        ].map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-lg bg-surface-subtle px-2 py-1.5 text-center lg:py-1">
            <metric.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="mt-1 min-w-0">
              <p className="truncate text-sm font-semibold leading-tight tnum text-foreground">{metric.value}</p>
              <p className="mt-0.5 truncate text-[0.6875rem] leading-tight text-muted-foreground">{metric.helper ?? metric.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
