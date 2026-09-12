"use client"

import { useLocale } from "@/components/providers/locale-provider"
import { buildPlannedSessions, type PlannedSession } from "@/components/workout-export-excel"
import {
  WorkoutExportDialog,
  type ExportContext,
  type ExportSelection,
  type ResolvedExportRange,
} from "@/components/workout/workout-export-dialog"
import { useExportQueries, useWorkoutSheetsExport } from "@/lib/queries/exports"
import { formatDateToISO, getProgramStartDate } from "@/lib/fitness/date-range"
import type { TraineeProgram } from "@/lib/fitness/types"

type ExportWorkoutDialogProps = {
  programs?: TraineeProgram[]
}

export function ExportWorkoutDialog({ programs = [] }: ExportWorkoutDialogProps) {
  const queries = useExportQueries()
  const sheetsExport = useWorkoutSheetsExport()
  const { messages } = useLocale()

  // Resolve which program a selection refers to: the picked one, or the only
  // assigned program when none is picked (e.g. Week mode).
  const resolveProgram = (selection: ExportSelection) =>
    programs.find((candidate) => candidate.id === selection.programId) ??
    (programs.length === 1 ? programs[0] : undefined)

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
    // Scope to the picked program (or the sole assigned program in Week mode) so
    // logs from other programs the trainee was on don't leak into this export.
    const scopedProgramId = resolveProgram(context)?.id
    return queries.workoutLogs({
      from: context.range.from,
      programId: scopedProgramId,
      to: context.range.to,
    })
  }

  const loadBodyMetrics = async (context: ExportContext) => {
    return queries.bodyMetrics({ from: context.range.from, to: context.range.to })
  }

  const exportToSheets = async (context: ExportContext) => {
    return sheetsExport.mutateAsync({
      from: context.range.from,
      label: context.range.label,
      to: context.range.to,
    })
  }

  // Planned schedule from the trainee's assigned program (lazily fetched per program).
  // Mirrors the coach flow: fetch the full program (all weeks) by id, not the
  // tuần-hiện-tại view from /api/workouts.
  const resolvePlannedSessions = async (selection: ExportSelection): Promise<PlannedSession[]> => {
    const program = resolveProgram(selection)
    if (!program) return []

    const detail = await queries.traineeProgram(program.id)

    const start = formatDateToISO(getProgramStartDate(program.assignedAt, program.duration))
    return buildPlannedSessions(detail.workouts, start)
  }

  return (
    <WorkoutExportDialog
      defaultMode="week"
      exportToSheets={exportToSheets}
      loadBodyMetrics={loadBodyMetrics}
      loadLogs={loadLogs}
      programs={programs.map((program) => ({
        id: program.id,
        name: `${program.name} (${program.duration} ${messages.workoutPage.weeks})`,
      }))}
      resolvePlannedSessions={resolvePlannedSessions}
      resolveProgramRange={resolveProgramRange}
      showProgramPicker
      title={messages.workoutPage.exportTitle}
      triggerLabel={messages.workoutPage.export}
    />
  )
}
