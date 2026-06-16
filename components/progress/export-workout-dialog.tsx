"use client"

import { useRef } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { buildPlannedSessions, type PlannedSession } from "@/components/workout-export-excel"
import {
  WorkoutExportDialog,
  type ExportContext,
  type ExportSelection,
  type ResolvedExportRange,
} from "@/components/workout/workout-export-dialog"
import { exportWorkoutLogsToGoogleSheets, fetchTraineeProgram, fetchWorkoutLogsForExport } from "@/lib/fitness/api"
import { formatDateToISO, getProgramStartDate } from "@/lib/fitness/date-range"
import type { CoachProgram, TraineeProgram } from "@/lib/fitness/types"

type ExportWorkoutDialogProps = {
  programs?: TraineeProgram[]
}

export function ExportWorkoutDialog({ programs = [] }: ExportWorkoutDialogProps) {
  const { session } = useAuth()
  const { messages } = useLocale()
  const programCacheRef = useRef<Map<string, CoachProgram>>(new Map())

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

  // Planned schedule from the trainee's assigned program (lazily fetched per program).
  // Mirrors the coach flow: fetch the full program (all weeks) by id, not the
  // tuần-hiện-tại view from /api/workouts.
  const resolvePlannedSessions = async (selection: ExportSelection): Promise<PlannedSession[]> => {
    if (!session?.access_token) return []
    const program = resolveProgram(selection)
    if (!program) return []

    let detail = programCacheRef.current.get(program.id)
    if (!detail) {
      detail = await fetchTraineeProgram(session.access_token, program.id)
      programCacheRef.current.set(program.id, detail)
    }

    const start = formatDateToISO(getProgramStartDate(program.assignedAt, program.duration))
    return buildPlannedSessions(detail.workouts, start)
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
      resolvePlannedSessions={resolvePlannedSessions}
      resolveProgramRange={resolveProgramRange}
      showProgramPicker
      title={messages.workoutPage.exportTitle}
      triggerLabel={messages.workoutPage.export}
    />
  )
}
