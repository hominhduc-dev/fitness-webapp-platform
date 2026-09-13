"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { DashboardWorkoutFrequencyPoint } from "@/lib/fitness/types"

export function WorkoutFrequencyChart({ data }: { data: DashboardWorkoutFrequencyPoint[] }) {
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border)" />
          <XAxis 
            dataKey="label" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <Tooltip 
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }}
          />
          <Bar dataKey="planned" fill="var(--border)" radius={[4, 4, 0, 0]} maxBarSize={12} />
          <Bar dataKey="completed" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
