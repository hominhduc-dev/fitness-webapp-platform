"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import {
  WorkoutExportDialog,
  type ExportContext,
  type ExportSelection,
  type ResolvedExportRange,
} from "@/components/workout/workout-export-dialog"
import { exportWorkoutLogsToGoogleSheets, fetchWorkoutLogsForExport } from "@/lib/fitness/api"
import { formatDateToISO, getProgramStartDate } from "@/lib/fitness/date-range"
import type { TraineeProgram } from "@/lib/fitness/types"

type ExportWorkoutDialogProps = {
  programs?: TraineeProgram[]
}

export function ExportWorkoutDialog({ programs = [] }: ExportWorkoutDialogProps) {
  const { session } = useAuth()
  const { messages } = useLocale()

  const resolveProgramRange = (selection: ExportSelection): ResolvedExportRange | { error: string } => {
    const program = programs.find((candidate) => candidate.id === selection.programId)
    if (!program) {
      return { error: messages.workoutPage.exportSelectProgramError }
    }

    const startDate = getProgramStartDate(program.assignedAt, program.duration)
    const from = formatDateToISO(startDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + program.duration * 7)
    // Tomorrow as upper bound so today's logs are included (query uses `lt`).
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const to = formatDateToISO(endDate < tomorrow ? endDate : tomorrow)

    return { from, label: program.name, programStartDate: from, to }
  }

  const loadLogs = async (context: ExportContext) => {
    if (!session?.access_token) return []
    return fetchWorkoutLogsForExport(session.access_token, { from: context.range.from, to: context.range.to })
  }

  const exportToSheets = async (context: ExportContext) => {
    if (!session?.access_token) throw new Error("No active session.")
    return exportWorkoutLogsToGoogleSheets(session.access_token, {
      from: context.range.from,
      label: context.range.label,
      to: context.range.to,
    })
  }

  return (
    <WorkoutExportDialog
      defaultMode="week"
      exportToSheets={exportToSheets}
      loadLogs={loadLogs}
      programs={programs.map((program) => ({
        id: program.id,
        name: `${program.name} (${program.duration} ${messages.workoutPage.weeks})`,
      }))}
      resolveProgramRange={resolveProgramRange}
      showProgramPicker
      title={messages.workoutPage.exportTitle}
      triggerLabel={messages.workoutPage.export}
    />
  )
}
