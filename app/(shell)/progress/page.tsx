"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, Dumbbell, Flame, Target, TrendingUp } from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { StatsCard } from "@/components/dashboard/stats-card"
import { useAuth } from "@/components/providers/auth-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchProgressAnalytics } from "@/lib/fitness/api"
import type { ProgressAnalytics } from "@/lib/fitness/types"

const EMPTY_ANALYTICS: ProgressAnalytics = {
  muscleGroupDistribution: [],
  personalRecords: [],
  strengthProgression: {
    points: [],
    series: [],
  },
  summary: {
    bestStreakDays: 0,
    currentStreakDays: 0,
    totalVolumeThisMonth: 0,
    workoutsThisMonth: 0,
  },
  weeklyVolume: [],
}

const TOOLTIP_STYLE = {
  backgroundColor: "#1F2937",
  border: "1px solid #374151",
  borderRadius: "8px",
}

function formatCompactNumber(value: number) {
  if (Math.abs(value) < 1000) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: value % 1 === 0 ? 0 : 1,
    }).format(value)
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value)
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(date)
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function ProgressPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_value, index) => (
          <Skeleton key={index} className="h-36 rounded-[24px]" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[26rem] rounded-xl" />
        <Skeleton className="h-[26rem] rounded-xl" />
        <Skeleton className="h-[22rem] rounded-xl lg:col-span-2" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_value, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function ProgressPage() {
  const { isLoading: authLoading, profile, session } = useAuth()
  const [analytics, setAnalytics] = useState<ProgressAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!session?.access_token) {
      setAnalytics(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadAnalytics = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const nextAnalytics = await fetchProgressAnalytics(session.access_token)

        if (!cancelled) {
          setAnalytics(nextAnalytics)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Unable to load progress analytics.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      cancelled = true
    }
  }, [authLoading, session?.access_token])

  const analyticsData = analytics ?? EMPTY_ANALYTICS
  const weightUnitLabel = profile?.preferredWeightUnit === "lbs" ? "lbs" : "kg"
  const strengthChartData = useMemo(
    () =>
      analyticsData.strengthProgression.points.map((point) => ({
        label: point.label,
        ...point.values,
      })),
    [analyticsData.strengthProgression.points],
  )

  const hasStrengthData = analyticsData.strengthProgression.series.length > 0
  const hasMuscleGroupData = analyticsData.muscleGroupDistribution.length > 0
  const hasWeeklyVolume = analyticsData.weeklyVolume.some((item) => item.volume > 0)
  const hasPersonalRecords = analyticsData.personalRecords.length > 0

  if (authLoading || (isLoading && analytics == null)) {
    return <ProgressPageSkeleton />
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Progress & Analytics</h1>
        <p className="mt-1 text-muted-foreground">Track your fitness journey with real workout data from your log history.</p>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Current Streak"
          value={`${analyticsData.summary.currentStreakDays} day${analyticsData.summary.currentStreakDays === 1 ? "" : "s"}`}
          subtitle="Consecutive active days"
          icon={Flame}
          variant="accent"
        />
        <StatsCard
          title="This Month"
          value={analyticsData.summary.workoutsThisMonth}
          subtitle="workouts completed"
          icon={Target}
          variant="primary"
        />
        <StatsCard
          title="Total Volume"
          value={formatCompactNumber(analyticsData.summary.totalVolumeThisMonth)}
          subtitle={`${weightUnitLabel} logged this month`}
          icon={TrendingUp}
        />
        <StatsCard
          title="Best Streak"
          value={`${analyticsData.summary.bestStreakDays} day${analyticsData.summary.bestStreakDays === 1 ? "" : "s"}`}
          subtitle="Personal record"
          icon={Calendar}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Strength Progression</h3>
          <div className="h-72">
            {hasStrengthData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={strengthChartData}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => {
                      const displayValue = Array.isArray(value) ? value.join(", ") : value ?? "--"
                      return `${displayValue} ${weightUnitLabel}`
                    }}
                    labelStyle={{ color: "#F9FAFB" }}
                  />
                  {analyticsData.strengthProgression.series.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      stroke={series.color}
                      strokeWidth={2}
                      dot={{ fill: series.color, strokeWidth: 0 }}
                      name={series.exerciseName}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Complete weighted sets across a few weeks to unlock strength progression." />
            )}
          </div>

          {hasStrengthData ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
              {analyticsData.strengthProgression.series.map((series) => (
                <div key={series.key} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: series.color }} />
                  <span className="text-muted-foreground">{series.exerciseName}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Muscle Group Distribution</h3>
          <div className="flex h-72 items-center justify-center">
            {hasMuscleGroupData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.muscleGroupDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {analyticsData.muscleGroupDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => {
                      const displayValue = Array.isArray(value) ? value.join(", ") : value ?? "--"
                      return `${displayValue}%`
                    }}
                    labelStyle={{ color: "#F9FAFB" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Log more workouts to see which muscle groups actually dominate your training." />
            )}
          </div>

          {hasMuscleGroupData ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
              {analyticsData.muscleGroupDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold">Weekly Workout Volume</h3>
          <div className="h-64">
            {hasWeeklyVolume ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.weeklyVolume}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => {
                      const displayValue = Array.isArray(value) ? value.join(", ") : value ?? "--"
                      return `${displayValue} ${weightUnitLabel}`
                    }}
                    labelStyle={{ color: "#F9FAFB" }}
                  />
                  <Bar dataKey="volume" fill="#22C55E" radius={[4, 4, 0, 0]} name={`Volume (${weightUnitLabel})`} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="No logged workout volume in the last 7 days yet." />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">Personal Records</h2>
        {hasPersonalRecords ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {analyticsData.personalRecords.map((record) => (
              <div
                key={`${record.exercise}-${record.date.toISOString()}`}
                className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Dumbbell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{record.exercise}</p>
                    <p className="text-xs text-muted-foreground">{formatShortDate(record.date)}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {record.weight} <span className="text-sm font-normal text-muted-foreground">{weightUnitLabel}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
            Complete weighted sets in your workout logs to generate real personal records.
          </div>
        )}
      </div>
    </div>
  )
}
