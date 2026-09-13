"use client"

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { DashboardBodyProgress } from "@/lib/fitness/types"

export function BodyProgressChart({ data }: { data: DashboardBodyProgress }) {
  // Use weight data for the line chart per the mockup
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.weight} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            dy={10}
            tickFormatter={(val) => {
              const d = new Date(val)
              return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            }}
          />
          <YAxis 
            domain={['auto', 'auto']}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <Tooltip 
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
          />
          <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)", r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
