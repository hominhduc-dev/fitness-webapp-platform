import Link from "next/link"
import { Plus } from "lucide-react"

import { ProgramsBoard } from "@/components/coach/programs-board"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms, fetchCoachTrainees } from "@/lib/fitness/api"

export default async function CoachProgramsPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })
  const [programs, trainees] = await Promise.all([
    fetchCoachPrograms(accessToken),
    fetchCoachTrainees(accessToken),
  ])

  const totalAssignments = programs.reduce((sum, program) => sum + program.assignedTrainees.length, 0)
  const totalWorkouts = programs.reduce((sum, program) => sum + program.workouts.length, 0)
  const unassigned = programs.filter((program) => program.assignedTrainees.length === 0).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-micro">Programs</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">{programs.length} authored.</h1>
          <p className="mt-1.5 font-mono text-[13px] tnum text-muted-foreground">
            {totalAssignments} clients training on a program · {unassigned} unassigned
          </p>
        </div>
        <Link href="/coach/programs/new">
          <Button className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            New program
          </Button>
        </Link>
      </div>

      {/* Stats — hairline cards, no shadow, tabular numbers */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Programs", value: programs.length },
          { label: "Assignments", value: totalAssignments },
          { label: "Workouts", value: totalWorkouts },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[10px] border border-border bg-card p-4 text-center">
            <p className="font-mono text-2xl font-semibold tnum">{stat.value}</p>
            <p className="label-micro mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <ProgramsBoard initialPrograms={programs} trainees={trainees} />
    </div>
  )
}
