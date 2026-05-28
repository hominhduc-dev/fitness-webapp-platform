"use client"

import { CartesianGrid, Line, LineChart, ResponsiveContainer, YAxis } from "recharts"

import type { ProgressAnalytics } from "@/lib/fitness/types"

type StrengthChartProps = {
  analytics: ProgressAnalytics
  weightUnitLabel: string
}

export function StrengthChart({ analytics, weightUnitLabel: _weightUnitLabel }: StrengthChartProps) {
  const { series, points } = analytics.strengthProgression
  if (series.length === 0) {
    return (
      <div className="flex min-h-[14rem] items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-muted-foreground">
        Complete weighted sets across a few weeks to unlock strength progression.
      </div>
    )
  }

  const chartData = points.map((point) => ({ label: point.label, ...point.values }))

  return (
    <div className="rounded-[10px] border border-border bg-card p-5">
      <span className="label-micro mb-4 block">Strength progression</span>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
            <CartesianGrid strokeDasharray="0" stroke="var(--border)" strokeWidth={1} vertical={false} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            />
            {series.map((entry) => (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                stroke="var(--chart-1)"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 4, fill: "var(--chart-1)", strokeWidth: 0 }}
                name={entry.exerciseName}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {series.map((entry) => (
          <div key={entry.key} className="label-micro inline-flex items-center gap-1.5">
            <span className="rounded-full" style={{ width: 6, height: 6, background: "var(--chart-1)", display: "inline-block" }} />
            {entry.exerciseName}
          </div>
        ))}
      </div>
    </div>
  )
}
