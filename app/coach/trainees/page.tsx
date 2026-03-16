import Link from "next/link"
import { Calendar, TrendingUp, Users } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachTrainees } from "@/lib/fitness/api"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

export default async function TraineesPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })
  const trainees = await fetchCoachTrainees(accessToken)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Trainees</h1>
                <p className="mt-1 text-muted-foreground">Live trainee list synced from Prisma/Postgres</p>
              </div>
            </div>

            {trainees.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-lg font-semibold">No trainees assigned</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Once trainees connect to this coach, they will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trainees.map((trainee) => (
                  <Link
                    key={trainee.id}
                    href={`/coach/trainees/${trainee.id}`}
                    className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {getInitials(trainee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{trainee.name}</h3>
                        <p className="text-sm text-muted-foreground">{trainee.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {trainee.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {trainee.fitnessGoals.length > 0 ? (
                        trainee.fitnessGoals.map((goal) => (
                          <span key={goal} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {goal}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">No goals added</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{trainee.thisWeekWorkouts}</p>
                          <p className="text-xs text-muted-foreground">This week</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{trainee.programCount}</p>
                          <p className="text-xs text-muted-foreground">Programs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <div>
                          <p className="text-sm font-medium text-success">{trainee.totalWorkoutLogs}</p>
                          <p className="text-xs text-muted-foreground">All logs</p>
                        </div>
                      </div>
                    </div>
                  </Link>
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
