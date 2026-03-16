import Link from "next/link"
import { ArrowLeft, Calendar, Dumbbell, Mail, TrendingUp, Users } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachTraineeDetail } from "@/lib/fitness/api"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

export default async function TraineeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { accessToken } = await requireAppSession({ role: "coach" })
  const detail = await fetchCoachTraineeDetail(accessToken, id)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <div className="mb-6 flex items-center gap-3">
              <Link href="/coach/trainees">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">{detail.trainee.name}</h1>
                <p className="mt-1 text-muted-foreground">Trainee detail and recent progress</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20 border-2 border-primary/20">
                      <AvatarImage src={detail.trainee.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl">
                        {getInitials(detail.trainee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xl font-semibold">{detail.trainee.name}</p>
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{detail.trainee.email}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Joined {detail.trainee.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {detail.trainee.fitnessGoals.length > 0 ? (
                      detail.trainee.fitnessGoals.map((goal) => (
                        <span key={goal} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                          {goal}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">No goals added</span>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Dumbbell className="h-4 w-4" />
                      <span className="text-sm">Programs</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold">{detail.trainee.programCount}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">This Week</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold">{detail.trainee.thisWeekWorkouts}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">All Logs</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold">{detail.trainee.totalWorkoutLogs}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Assigned Programs</h2>
                    <span className="text-sm text-muted-foreground">{detail.programs.length} total</span>
                  </div>

                  {detail.programs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No program assigned to this trainee yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.programs.map((program) => (
                        <Link
                          key={program.id}
                          href={`/coach/programs/${program.id}`}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 transition-colors hover:border-primary/30"
                        >
                          <div>
                            <p className="font-medium">{program.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {program.workoutsPerWeek} workouts/week · {program.duration} weeks
                            </p>
                          </div>
                          <span className="text-xs capitalize text-muted-foreground">{program.difficulty}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <RecentActivity logs={detail.recentLogs} />
              </div>
            </div>
          </div>
        </main>

        <MobileNav role="coach" />
      </div>
    </div>
  )
}
