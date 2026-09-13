"use client"

import { useLocale } from "@/components/providers/locale-provider"

type Props = {
  data: {
    groups: Array<{ fill: string; name: string; value: number; volume: number }>
    totalVolume: number
  }
}

export function MuscleDistributionChart({ data }: Props) {
  const { locale, messages } = useLocale()
  if (!data.groups.length) return <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">{messages.progressPage.analytics.empty}</p>
  return (
    <div className="space-y-4">
      {[...data.groups].sort((a, b) => b.value - a.value).map((group) => (
        <div key={group.name} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-4 text-xs">
          <span className="truncate text-muted-foreground" title={group.name}>{group.name}</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" title={`${group.volume.toLocaleString(locale)} kg`}>
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, group.value))}%` }} />
          </div>
          <span className="text-right tabular-nums">{group.value}%</span>
        </div>
      ))}
    </div>
  )
}
