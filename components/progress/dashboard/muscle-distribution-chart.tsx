"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

type Props = {
  data: {
    groups: Array<{ fill: string; name: string; value: number; volume: number }>
    totalVolume: number
  }
}

export function MuscleDistributionChart({ data }: Props) {
  return (
    <div className="flex h-[250px] w-full items-center">
      <div className="h-full w-1/2 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.groups}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.groups.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(_value, name, item) => {
                const volume = item.payload?.volume

                return [
                  typeof volume === "number" ? `${volume.toLocaleString()} kg` : "—",
                  String(name),
                ]
              }}
              contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-1/2 flex flex-col justify-center gap-2 pr-4">
        {data.groups.map((group, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.fill }} />
              <span className="text-muted-foreground">{group.name}</span>
            </div>
            <span className="font-mono tnum text-foreground">{group.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
