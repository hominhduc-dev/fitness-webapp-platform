"use client"

import { useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { useLocale } from "@/components/providers/locale-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { formatReadinessScore, READINESS_SCALE_MAX, toReadinessScale } from "@/lib/fitness/readiness"
import { useRecoveryHistory } from "@/lib/queries/progress"
import { cn } from "@/lib/utils"

const RANGES = [7, 30] as const

/**
 * One readiness score answers "today". The trend answers whether the week is
 * going the way the trainee thinks it is, which is the question that decides
 * whether to push or back off.
 */
export function ReadinessTrend() {
  const { locale, messages } = useLocale()
  const copy = messages.volumeRecovery
  const localeCode = locale === "vi" ? "vi-VN" : "en-US"
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const query = useRecoveryHistory(days)

  const points = (query.data?.entries ?? [])
    .filter((entry) => entry.readinessScore != null)
    .map((entry) => ({
      label: new Date(`${entry.checkInDate}T00:00:00.000Z`).toLocaleDateString(localeCode, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      value: Number(toReadinessScale(entry.readinessScore as number).toFixed(1)),
    }))
  const averageSleepMinutes = query.data?.averages.sleepMinutes ?? null

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{copy.trend}</h2>
        <div className="flex gap-1" role="group" aria-label={copy.trend}>
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              aria-pressed={days === range}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-micro transition-colors",
                days === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {range === 7 ? copy.last7 : copy.last30}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        <p className="text-xs text-muted-foreground">
          {copy.avgReadiness}{" "}
          <span className="font-mono text-sm font-semibold tnum text-foreground">
            {formatReadinessScore(query.data?.averages.readinessScore)}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {copy.avgSleep}{" "}
          <span className="font-mono text-sm font-semibold tnum text-foreground">
            {averageSleepMinutes == null ? "—" : `${Math.floor(averageSleepMinutes / 60)}h ${averageSleepMinutes % 60}m`}
          </span>
        </p>
      </div>

      {query.isPending ? (
        <Skeleton className="mt-4 h-48 rounded-lg" />
      ) : points.length < 2 ? (
        <p className="mt-4 text-sm text-muted-foreground">{copy.trendEmpty}</p>
      ) : (
        <div className="mt-4 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ bottom: 0, left: -22, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="readiness-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                domain={[0, READINESS_SCALE_MAX]}
                ticks={[0, 5, 10]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                formatter={(value: number) => [`${value} / ${READINESS_SCALE_MAX}`, copy.readiness]}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#readiness-trend-fill)"
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
