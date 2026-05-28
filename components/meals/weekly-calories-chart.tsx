"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { WeeklyCaloriesPoint } from "@/lib/fitness/types"

type WeeklyCaloriesChartProps = {
  actualLabel: string
  targetLabel: string
  weeklyCalories: WeeklyCaloriesPoint[]
}

export function WeeklyCaloriesChart({ actualLabel, targetLabel, weeklyCalories }: WeeklyCaloriesChartProps) {
  return (
    <>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeklyCalories}>
            <defs>
              <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <YAxis hide domain={[0, 3000]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#F9FAFB" }}
            />
            <Area type="monotone" dataKey="calories" stroke="#22C55E" strokeWidth={2} fill="url(#calorieGradient)" />
            <Area
              type="monotone"
              dataKey="target"
              stroke="#374151"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">{actualLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border border-muted-foreground" />
          <span className="text-muted-foreground">{targetLabel}</span>
        </div>
      </div>
    </>
  )
}
