"use client"

import { Check, Dumbbell, Loader2 } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { acceptAIProgram, type AIChatAction } from "@/lib/fitness/api"

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

/**
 * Draft program the assistant built during a chat turn. Nothing is persisted
 * until the trainee confirms here — accepting calls the same endpoint the
 * dedicated /workout/ai-generate flow uses.
 */
function ChatProgramCard({
  action,
  accessToken,
}: {
  action: AIChatAction
  accessToken: string
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const handleAccept = useCallback(async () => {
    setStatus("saving")
    setError(null)
    try {
      await acceptAIProgram(accessToken, action.generationId)
      setStatus("saved")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Không lưu được chương trình.")
    }
  }, [accessToken, action.generationId])

  const { program } = action

  return (
    <div className="mt-2 rounded-xl border bg-background p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Dumbbell className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{program.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {program.duration} tuần · {program.workoutsPerWeek} buổi/tuần · {action.mappingRate}% bài tập khớp
          </p>
        </div>
      </div>

      <ul className="mt-2.5 space-y-1">
        {program.workouts.map((workout, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{WEEKDAY_LABELS[workout.scheduledDay] ?? "—"}</span>{" "}
              {workout.name}
            </span>
            <span className="shrink-0 text-muted-foreground">{workout.exercises.length} bài</span>
          </li>
        ))}
      </ul>

      {status === "saved" ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Check className="size-3.5" />
          Đã lưu vào chương trình của bạn
        </div>
      ) : (
        <Button
          size="sm"
          className="mt-3 h-8 w-full text-xs"
          disabled={status === "saving"}
          onClick={() => void handleAccept()}
        >
          {status === "saving" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Đang lưu...
            </>
          ) : (
            "Dùng chương trình này"
          )}
        </Button>
      )}

      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

export { ChatProgramCard }
