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
import { exportCoachWorkoutLogsToGoogleSheets, fetchCoachProgram, fetchCoachWorkoutLogs } from "@/lib/fitness/api"
import { formatDateToISO, getProgramStartDate } from "@/lib/fitness/date-range"
import type { AssignedTrainee, CoachProgram } from "@/lib/fitness/types"

type ExportProgramLogsDialogProps = {
  assignedTrainees: AssignedTrainee[]
  programDuration: number
  programId: string
  programName: string
}

async function loadAllCoachLogs(
  accessToken: string,
  traineeId: string,
  from: string,
  programId: string,
  to: string,
) {
  const allLogs: Awaited<ReturnType<typeof fetchCoachWorkoutLogs>>["logs"] = []
  let cursor: string | undefined

  for (let page = 0; page < 20; page++) {
    const result = await fetchCoachWorkoutLogs(accessToken, traineeId, {
      cursor,
      from,
      limit: 50,
      programId,
      to,
    })
    allLogs.push(...result.logs)

    if (!result.nextCursor) break
    cursor = result.nextCursor
  }

  return allLogs
}

export function ExportProgramLogsDialog({
  assignedTrainees,
  programDuration,
  programId,
  programName,
}: ExportProgramLogsDialogProps) {
  const { session } = useAuth()
  const { messages } = useLocale()
  const programRef = useRef<CoachProgram | null>(null)

  if (assignedTrainees.length === 0) return null

  const resolveProgramRange = (selection: ExportSelection): ResolvedExportRange | { error: string } => {
    const trainee = assignedTrainees.find((candidate) => candidate.id === selection.subjectId)
    if (!trainee) {
      return { error: messages.workoutPage.exportSelectProgramError }
    }

    // Program window is anchored to the selected trainee's assignment date.
    const startDate = getProgramStartDate(trainee.assignedAt, programDuration)
    const from = formatDateToISO(startDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + programDuration * 7)
    // Tomorrow as upper bound so today's logs are included (query uses `lt`).
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const to = formatDateToISO(endDate < tomorrow ? endDate : tomorrow)

    return { from, label: programName, programStartDate: from, to }
  }

  // Program export is scoped by both programId and the assignment date window.
  // The backend still includes legacy null-program logs inside the date window,
  // but logs from other programs are excluded.
  const loadLogs = async (context: ExportContext) => {
    if (!session?.access_token || !context.subjectId) return []
    return loadAllCoachLogs(session.access_token, context.subjectId, context.range.from, programId, context.range.to)
  }

  const exportToSheets = async (context: ExportContext) => {
    if (!session?.access_token || !context.subjectId) throw new Error("No trainee selected.")
    return exportCoachWorkoutLogsToGoogleSheets(session.access_token, context.subjectId, {
      from: context.range.from,
      label: context.range.label,
      programId,
      to: context.range.to,
    })
  }

  // Planned schedule from the program, anchored to the selected trainee's start.
  const resolvePlannedSessions = async (selection: ExportSelection): Promise<PlannedSession[]> => {
    if (!session?.access_token) return []
    const trainee = assignedTrainees.find((candidate) => candidate.id === selection.subjectId)
    if (!trainee) return []

    if (!programRef.current) {
      programRef.current = await fetchCoachProgram(session.access_token, programId)
    }

    const start = formatDateToISO(getProgramStartDate(trainee.assignedAt, programDuration))
    return buildPlannedSessions(programRef.current.workouts, start)
  }

  return (
    <WorkoutExportDialog
      defaultMode="program"
      description={messages.workoutPage.exportProgramSummary(programDuration)}
      dialogContentClassName="z-[90]"
      dialogOverlayClassName="z-[85]"
      exportToSheets={exportToSheets}
      loadLogs={loadLogs}
      resolvePlannedSessions={resolvePlannedSessions}
      resolveProgramRange={resolveProgramRange}
      subjectPlaceholder={messages.workoutPage.exportSelectTraineePlaceholder}
      subjectSelectLabel={messages.workoutPage.exportSelectTrainee}
      subjects={assignedTrainees.map((trainee) => ({
        id: trainee.id,
        label: `${trainee.name} (${trainee.email})`,
        name: trainee.name,
      }))}
      title={`${messages.workoutPage.exportLogs} - ${programName}`}
      triggerLabel={messages.workoutPage.exportLogs}
    />
  )
}
