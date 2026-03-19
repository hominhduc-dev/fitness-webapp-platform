import Link from "next/link"
import { Calendar, Clock, Dumbbell, Plus, Users } from "lucide-react"
import { Suspense, cache } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms } from "@/lib/fitness/api"

type CoachPrograms = Awaited<ReturnType<typeof fetchCoachPrograms>>

const getCoachPrograms = cache(async (accessToken: string) => fetchCoachPrograms(accessToken))

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "beginner":
      return "bg-success/20 text-success border-success/30"
    case "intermediate":
      return "bg-secondary/20 text-secondary border-secondary/30"
    case "advanced":
      return "bg-accent/20 text-accent border-accent/30"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

async function ProgramsStats({ accessToken }: { accessToken: string }) {
  const programs = await getCoachPrograms(accessToken)

  return (
    <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-4">
      <div className="rounded-xl border border-border bg-card p-3 text-center sm:p-4">
        <p className="text-xl font-bold text-primary sm:text-2xl">{programs.length}</p>
        <p className="text-xs text-muted-foreground sm:text-sm">Programs</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3 text-center sm:p-4">
        <p className="text-xl font-bold text-secondary sm:text-2xl">
          {programs.reduce((sum, program) => sum + program.assignedTrainees.length, 0)}
        </p>
        <p className="text-xs text-muted-foreground sm:text-sm">Assignments</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3 text-center sm:p-4">
        <p className="text-xl font-bold text-accent sm:text-2xl">
          {programs.reduce((sum, program) => sum + program.workouts.length, 0)}
        </p>
        <p className="text-xs text-muted-foreground sm:text-sm">Workouts</p>
      </div>
    </div>
  )
}

function ProgramsStatsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-3 text-center sm:p-4">
          <Skeleton className="mx-auto h-7 w-12 sm:h-8" />
          <Skeleton className="mx-auto mt-2 h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

async function ProgramsList({ accessToken }: { accessToken: string }) {
  const programs = await getCoachPrograms(accessToken)

  return <ProgramsListContent programs={programs} />
}

function ProgramsListContent({ programs }: { programs: CoachPrograms }) {
  if (programs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Dumbbell className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">No programs yet</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Create your first program to start assigning workouts to trainees.
        </p>
        <Link href="/coach/programs/new">
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Create Program
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {programs.map((program) => (
        <div
          key={program.id}
          className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
        >
          <div className="p-3 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold sm:text-lg">{program.name}</h3>
                  <Badge variant="outline" className={`text-xs capitalize ${getDifficultyColor(program.difficulty)}`}>
                    {program.difficulty}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                  {program.description || "No description added."}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 sm:mt-4 sm:gap-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{program.duration} weeks</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                <Dumbbell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{program.workoutsPerWeek} sessions/week</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>{program.workouts.length} workouts</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 sm:mt-4 sm:pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {program.assignedTrainees.length > 0 ? (
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {program.assignedTrainees.slice(0, 3).map((trainee) => (
                        <Avatar key={trainee.id} className="h-6 w-6 border-2 border-card sm:h-7 sm:w-7">
                          <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {getInitials(trainee.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <span className="ml-2 text-xs text-muted-foreground sm:text-sm">
                      {program.assignedTrainees.length} trainees
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground sm:text-sm">Not assigned yet</span>
                )}
              </div>

              <span className="text-xs text-muted-foreground sm:text-sm">
                Created {program.createdAt.toLocaleDateString()}
              </span>
            </div>

            <div className="mt-4">
              <Link href={`/coach/programs/${program.id}`}>
                <Button variant="outline" className="w-full bg-transparent">
                  View Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ProgramsListSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="p-3 sm:p-5">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full max-w-[26rem]" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 sm:pt-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>

              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function CoachProgramsPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Programs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your real training programs from PostgreSQL</p>
        </div>
        <Link href="/coach/programs/new">
          <Button className="w-full gap-2 bg-primary hover:bg-primary/90 sm:w-auto">
            <Plus className="h-4 w-4" />
            <span>Create Program</span>
          </Button>
        </Link>
      </div>

      <Suspense fallback={<ProgramsStatsSkeleton />}>
        <ProgramsStats accessToken={accessToken} />
      </Suspense>

      <Suspense fallback={<ProgramsListSkeleton />}>
        <ProgramsList accessToken={accessToken} />
      </Suspense>
    </div>
  )
}
