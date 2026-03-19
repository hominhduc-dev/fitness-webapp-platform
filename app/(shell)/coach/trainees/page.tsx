import Link from "next/link"
import { Calendar, Search, TrendingUp, Users } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachTrainees } from "@/lib/fitness/api"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

type TraineesPageProps = {
  searchParams?: Promise<{ phone?: string | string[] }> | { phone?: string | string[] }
}

function getPhoneQuery(value?: string | string[]) {
  if (typeof value === "string") {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : ""
  }

  return ""
}

export default async function TraineesPage({ searchParams }: TraineesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const phoneQuery = getPhoneQuery(resolvedSearchParams?.phone)
  const { accessToken } = await requireAppSession({ role: "coach" })
  const trainees = await fetchCoachTrainees(accessToken, {
    phone: phoneQuery,
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Trainees</h1>
          <p className="mt-1 text-muted-foreground">
            Live trainee list synced from Prisma/Postgres. Search by phone number to find a trainee faster.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="phone"
              defaultValue={phoneQuery}
              placeholder="Search trainee by phone number..."
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
          <Button asChild type="button" variant="outline">
            <Link href="/coach/trainees">Clear</Link>
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          You can search with part of the number. Spaces, dashes, and plus signs are ignored.
        </p>
      </div>

      {trainees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-lg font-semibold">
            {phoneQuery ? "No trainee matched this phone number" : "No trainees assigned"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {phoneQuery
              ? "Try another phone number or clear the search to see the full trainee list."
              : "Once trainees connect to this coach, they will appear here automatically."}
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
              <div className="mb-4 flex items-start gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/20">
                  <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    {getInitials(trainee.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold transition-colors group-hover:text-primary">{trainee.name}</h3>
                  <p className="text-sm text-muted-foreground">{trainee.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {trainee.phone ? `Phone ${trainee.phone}` : "No phone number"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Joined {trainee.createdAt.toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trainee.latestWeightKg != null ? `Latest weight ${trainee.latestWeightKg} kg` : "No body metrics yet"}
                    {trainee.lastCheckInAt ? ` • Check-in ${trainee.lastCheckInAt.toLocaleDateString()}` : " • No check-in yet"}
                  </p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-1">
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

              <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
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
  )
}
