import Link from "next/link"
import { Calendar, Clock, Dumbbell, Plus, Users } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms } from "@/lib/fitness/api"

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

export default async function CoachProgramsPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })
  const programs = await fetchCoachPrograms(accessToken)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
            <div className="flex flex-col gap-3 mb-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">Programs</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage your real training programs from PostgreSQL</p>
              </div>
              <Link href="/coach/programs/new">
                <Button className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  <span>Create Program</span>
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-xl font-bold text-primary sm:text-2xl">{programs.length}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">Programs</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-xl font-bold text-secondary sm:text-2xl">
                  {programs.reduce((sum, program) => sum + program.assignedTrainees.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">Assignments</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 text-center">
                <p className="text-xl font-bold text-accent sm:text-2xl">
                  {programs.reduce((sum, program) => sum + program.workouts.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">Workouts</p>
              </div>
            </div>

            {programs.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-dashed border-border">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Dumbbell className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No programs yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first program to start assigning workouts to trainees.
                </p>
                <Link href="/coach/programs/new">
                  <Button className="gap-2 bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4" />
                    Create Program
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {programs.map((program) => (
                  <div
                    key={program.id}
                    className="rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/30"
                  >
                    <div className="p-3 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold sm:text-lg truncate">{program.name}</h3>
                            <Badge variant="outline" className={`text-xs capitalize ${getDifficultyColor(program.difficulty)}`}>
                              {program.difficulty}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 sm:text-sm">
                            {program.description || "No description added."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-3 sm:gap-4 sm:mt-4">
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

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border sm:mt-4 sm:pt-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {program.assignedTrainees.length > 0 ? (
                            <div className="flex items-center">
                              <div className="flex -space-x-2">
                                {program.assignedTrainees.slice(0, 3).map((trainee) => (
                                  <Avatar key={trainee.id} className="h-6 w-6 sm:h-7 sm:w-7 border-2 border-card">
                                    <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
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
            )}
          </div>
        </main>

        <MobileNav role="coach" />
      </div>
    </div>
  )
}
