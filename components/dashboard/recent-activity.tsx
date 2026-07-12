"use client"

import { CheckCircle2, Clock, Dumbbell } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { WorkoutLog } from "@/lib/types"

interface RecentActivityProps {
  logs: WorkoutLog[]
}

export function RecentActivity({ logs }: RecentActivityProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Recent Activity</h3>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No recent workouts</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4 rounded-lg bg-muted/30 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{log.workout.name}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(log.completedAt || log.startedAt, { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.round(((log.completedAt?.getTime() || 0) - log.startedAt.getTime()) / 60000)} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3.5 w-3.5" />
                    {log.exercises.length} exercises
                  </span>
                  {log.totalVolume && <span>{log.totalVolume.toLocaleString()} lbs</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
